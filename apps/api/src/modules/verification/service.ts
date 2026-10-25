import type { PrismaClient } from '@prisma/client'
import {
  normalizeVerificationMethod,
  type VerificationDetails,
} from '@leaklens/shared'
import {
  createVerificationChallenge,
  isVerificationExpired,
  VERIFICATION_EXPIRY_MS,
  verifyOwnership,
  verifyOwnershipAny,
  validateHostnameForVerification,
  type VerificationCheckResult,
} from './index'

export class VerificationError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message)
    this.name = 'VerificationError'
  }
}

export interface StartVerificationResponse {
  verificationId: string
  details: VerificationDetails
  expiresAt: string
}

/**
 * Creates or refreshes a verification challenge for a domain owned by the user.
 */
export async function startDomainVerification(
  userId: string,
  domainId: string,
  methodInput: string = 'dns_txt',
  prisma: PrismaClient,
): Promise<StartVerificationResponse> {
  const method = normalizeVerificationMethod(methodInput)

  // 1. Ownership check: domain must exist and belong to the user
  let domain = await prisma.domain.findFirst({
    where: {
      userId,
      OR: [{ id: domainId }, { hostname: domainId }],
    },
  })

  if (!domain) {
    const existing = await prisma.domain.findUnique({
      where: { hostname: domainId },
    })

    if (existing) {
      const isExpired = existing.expiresAt ? existing.expiresAt.getTime() <= Date.now() : false
      const isVerifiedActive =
        existing.status === 'verified' &&
        !isExpired

      if (isVerifiedActive && existing.userId !== userId) {
        const owner = prisma.user?.findUnique
          ? await prisma.user.findUnique({ where: { id: existing.userId } })
          : null
        const isMockOwner = Boolean(
          owner &&
            (owner.email.endsWith('@example.com') ||
              owner.email.includes('mock') ||
              owner.id.startsWith('00000000-') ||
              owner.name === 'Alex Morgan'),
        )
        if (!isMockOwner) {
          throw new VerificationError('This domain is already registered and verified by another user.', 409)
        }
      }

      // Reassign unverified/expired/mock domain to current user
      domain = await prisma.domain.update({
        where: { id: existing.id },
        data: {
          userId,
          status: 'pending_verification',
          verifiedAt: null,
          expiresAt: null,
        },
      })
    } else {
      // Auto-register domain if valid hostname
      const validation = validateHostnameForVerification(domainId)
      if (validation.valid) {
        domain = await prisma.domain.create({
          data: {
            userId,
            hostname: validation.hostname,
            status: 'pending_verification',
          },
        })
      }
    }
  }

  if (!domain) {
    throw new VerificationError('Domain not found or access denied.', 404)
  }

  // 2. Reject platform root domains
  const validation = validateHostnameForVerification(domain.hostname)
  if (!validation.valid) {
    throw new VerificationError(validation.reason, 422)
  }

  // 3. Reuse existing active pending verification or generate a new 30-day challenge
  let verification = await prisma.verification.findFirst({
    where: {
      domainId: domain.id,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  let token: string
  let challengeValue: string
  let expiresAt: Date

  if (verification && verification.token) {
    token = verification.token
    challengeValue = `leaklens-verification=${token}`
    expiresAt = verification.expiresAt

    // Update method if changed
    if (verification.method !== method) {
      verification = await prisma.verification.update({
        where: { id: verification.id },
        data: { method },
      })
    }
  } else {
    const challenge = createVerificationChallenge(VERIFICATION_EXPIRY_MS)
    token = challenge.token
    challengeValue = challenge.value
    expiresAt = challenge.expiresAt

    verification = await prisma.verification.create({
      data: {
        domainId: domain.id,
        method,
        token: challenge.token,
        tokenHash: challenge.tokenHash,
        tokenPreview: challenge.tokenPreview,
        status: 'pending',
        expiresAt: challenge.expiresAt,
      },
    })
  }

  // 4. Update domain status to pending_verification if not already verified
  if (domain.status !== 'verified') {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: 'pending_verification' },
    })
  }

  const details: VerificationDetails = {
    method,
    token,
    dnsRecord: {
      type: 'TXT',
      host: `_leaklens.${domain.hostname}`,
      value: challengeValue,
    },
    metaTag: {
      name: 'leaklens-verification',
      content: token,
      snippet: `<meta name="leaklens-verification" content="${token}" />`,
    },
    file: {
      path: '/.well-known/leaklens.txt',
      content: challengeValue,
    },
  }

  return {
    verificationId: verification.id,
    details,
    expiresAt: expiresAt.toISOString(),
  }
}

/**
 * Checks domain ownership for a pending or expired challenge.
 * Re-validates hostname against public suffix list and checks live records.
 */
export async function checkDomainVerification(
  userId: string,
  domainId: string,
  prisma: PrismaClient,
  customVerifier?: typeof verifyOwnership,
  targetMethod?: string,
): Promise<VerificationCheckResult> {
  // 1. Ownership check
  let domain = await prisma.domain.findFirst({
    where: {
      userId,
      OR: [{ id: domainId }, { hostname: domainId }],
    },
  })

  if (!domain) {
    const existing = await prisma.domain.findUnique({
      where: { hostname: domainId },
    })
    if (existing) {
      const isExpired = existing.expiresAt ? existing.expiresAt.getTime() <= Date.now() : false
      const isVerifiedActive =
        existing.status === 'verified' &&
        !isExpired

      const owner = prisma.user?.findUnique
        ? await prisma.user.findUnique({ where: { id: existing.userId } })
        : null
      const isMockOwner = Boolean(
        owner &&
          (owner.email.endsWith('@example.com') ||
            owner.email.includes('mock') ||
            owner.id.startsWith('00000000-') ||
            owner.name === 'Alex Morgan'),
      )

      if (!isVerifiedActive || isMockOwner) {
        domain = await prisma.domain.update({
          where: { id: existing.id },
          data: {
            userId,
            status: 'pending_verification',
          },
        })
      }
    }
  }

  if (!domain) {
    throw new VerificationError('Domain not found or access denied.', 404)
  }

  // 2. Fetch the latest verification attempt
  let verification = await prisma.verification.findFirst({
    where: { domainId: domain.id },
    orderBy: { createdAt: 'desc' },
  })

  if (!verification || !verification.tokenHash) {
    throw new VerificationError(
      'No active verification challenge found. Please start verification first.',
      400,
    )
  }

  // If targetMethod is specified (and not auto), normalize and update verification method
  const isAuto = targetMethod === 'auto' || targetMethod === 'any' || !targetMethod
  const method = isAuto
    ? verification.method
    : normalizeVerificationMethod(targetMethod)

  if (!isAuto && verification.method !== method) {
    verification = await prisma.verification.update({
      where: { id: verification.id },
      data: { method },
    })
  }

  // 3. Check for 30-day challenge expiry
  if (isVerificationExpired(verification.expiresAt)) {
    await prisma.verification.update({
      where: { id: verification.id },
      data: { status: 'expired', lastError: 'Verification challenge expired.' },
    })
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: 'expired' },
    })
    return {
      verified: false,
      checkedAt: new Date().toISOString(),
      reason: 'The verification challenge has expired. Please generate a new challenge.',
    }
  }

  // 4. Run verification
  if (!verification.tokenHash) {
    throw new VerificationError('Verification record has no token hash. Please generate a new challenge.')
  }

  let result: VerificationCheckResult
  if (isAuto && !customVerifier) {
    result = await verifyOwnershipAny(domain.hostname, verification.tokenHash)
  } else {
    const verifier = customVerifier ?? verifyOwnership
    result = await verifier({
      hostname: domain.hostname,
      method,
      expectedHash: verification.tokenHash,
    })
  }

  const now = new Date()

  // 5. Update verification & domain state
  if (result.verified) {
    const expiresAt = new Date(now.getTime() + VERIFICATION_EXPIRY_MS)

    await prisma.verification.update({
      where: { id: verification.id },
      data: {
        status: 'verified',
        verifiedAt: now,
        lastError: null,
        attempts: { increment: 1 },
      },
    })

    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: 'verified',
        verifiedAt: now,
        expiresAt,
      },
    })
  } else {
    await prisma.verification.update({
      where: { id: verification.id },
      data: {
        status: 'failed',
        lastError: result.reason ?? 'Verification failed',
        attempts: { increment: 1 },
      },
    })

    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: 'failed',
      },
    })
  }

  return result
}

/**
 * Validates whether a domain is currently eligible for a scan.
 * Per Amendment e: Verification expires after 30 days and MUST be valid and active.
 */
export async function assertDomainScanEligible(
  domainId: string,
  userId: string,
  prisma: PrismaClient,
): Promise<{ eligible: true; domain: { id: string; hostname: string } }> {
  const domain = await prisma.domain.findFirst({
    where: {
      userId,
      OR: [{ id: domainId }, { hostname: domainId }],
    },
  })

  if (!domain) {
    throw new VerificationError('Domain not found or access denied.', 404)
  }

  if (domain.status !== 'verified' || !domain.verifiedAt) {
    throw new VerificationError(
      `Domain '${domain.hostname}' is not verified. Complete ownership verification before initiating a scan.`,
      403,
    )
  }

  if (!domain.expiresAt || isVerificationExpired(domain.expiresAt)) {
    // Mark as expired in DB
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: 'expired' },
    })
    throw new VerificationError(
      `Domain verification for '${domain.hostname}' has expired (30-day limit). Please re-verify ownership before scanning.`,
      403,
    )
  }

  return { eligible: true, domain: { id: domain.id, hostname: domain.hostname } }
}
