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
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, userId },
  })

  if (!domain) {
    throw new VerificationError('Domain not found or access denied.', 404)
  }

  // 2. Reject platform root domains
  const validation = validateHostnameForVerification(domain.hostname)
  if (!validation.valid) {
    throw new VerificationError(validation.reason, 422)
  }

  // 3. Generate 30-day challenge
  const challenge = createVerificationChallenge(VERIFICATION_EXPIRY_MS)

  // 4. Record challenge in database
  const verification = await prisma.verification.create({
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

  // 5. Update domain status to pending_verification
  await prisma.domain.update({
    where: { id: domain.id },
    data: { status: 'pending_verification' },
  })

  const details: VerificationDetails = {
    method,
    token: challenge.token,
    dnsRecord: {
      type: 'TXT',
      host: `_leaklens.${domain.hostname}`,
      value: challenge.value,
    },
    metaTag: {
      name: 'leaklens-verification',
      content: challenge.token,
      snippet: `<meta name="leaklens-verification" content="${challenge.token}" />`,
    },
    file: {
      path: '/.well-known/leaklens.txt',
      content: challenge.value,
    },
  }

  return {
    verificationId: verification.id,
    details,
    expiresAt: challenge.expiresAt.toISOString(),
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
): Promise<VerificationCheckResult> {
  // 1. Ownership check
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, userId },
  })

  if (!domain) {
    throw new VerificationError('Domain not found or access denied.', 404)
  }

  // 2. Fetch the latest verification attempt
  const verification = await prisma.verification.findFirst({
    where: { domainId: domain.id },
    orderBy: { createdAt: 'desc' },
  })

  if (!verification || !verification.tokenHash) {
    throw new VerificationError(
      'No active verification challenge found. Please start verification first.',
      400,
    )
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
  const verifier = customVerifier ?? verifyOwnership
  const result = await verifier({
    hostname: domain.hostname,
    method: verification.method,
    expectedHash: verification.tokenHash,
  })

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
    where: { id: domainId, userId },
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
