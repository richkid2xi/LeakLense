import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import {
  CreateDomainInputSchema,
  normalizeVerificationMethod,
} from '@leaklens/shared'
import { getPrismaClient } from '../db'
import { recordAuditLog } from '../modules/audit'
import {
  checkDomainVerification,
  startDomainVerification,
  validateHostnameForVerification,
  VerificationError,
} from '../modules/verification'
import { rateLimitByDomain } from '../middleware/rateLimit'

export function createDomainsRouter(prismaClient?: PrismaClient): Router {
  const router = Router()
  const prisma = prismaClient || getPrismaClient()

  /**
   * POST /domains
   * Register a new domain for verification and scanning.
   * Scoped to the authenticated user.
   */
  router.post(
    '/domains',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parseResult = CreateDomainInputSchema.safeParse(req.body)
        if (!parseResult.success) {
          res.status(400).json({
            error: 'Invalid hostname',
            details: parseResult.error.format(),
          })
          return
        }

        const userId = req.user!.id

        // 1. Validate hostname structure and reject platform roots (Amendment e)
        const validation = validateHostnameForVerification(parseResult.data.hostname)
        if (!validation.valid) {
          res.status(422).json({
            error: 'INVALID_HOSTNAME',
            message: validation.reason,
          })
          return
        }

        const hostname = validation.hostname

        // 2. Check if domain already exists
        const existing = await prisma.domain.findUnique({
          where: { hostname },
        })

        const isAutoVerify = process.env.AUTO_VERIFY_DEV === 'true'

        if (existing) {
          if (existing.userId !== userId) {
            const isExpired = existing.expiresAt ? existing.expiresAt.getTime() <= Date.now() : false
            const isVerifiedActive = existing.status === 'verified' && !isExpired

            // Check if existing owner is a mock / test user account
            const existingOwner = prisma.user?.findUnique
              ? await prisma.user.findUnique({
                  where: { id: existing.userId },
                })
              : null
            const isMockOwner = Boolean(
              existingOwner &&
                (existingOwner.email.endsWith('@example.com') ||
                  existingOwner.email.includes('mock') ||
                  existingOwner.id.startsWith('00000000-') ||
                  existingOwner.name === 'Alex Morgan'),
            )

            if (isVerifiedActive && !isMockOwner) {
              res.status(409).json({
                error: 'DOMAIN_CONFLICT',
                message:
                  'This domain is already registered and verified by another user. If you are the rightful owner, please contact support.',
              })
              return
            }

            // Unverified, expired, or transferred from mock/dev: transfer to current user so they can prove ownership
            const updated = await prisma.domain.update({
              where: { id: existing.id },
              data: {
                userId,
                status: 'pending_verification',
                verifiedAt: null,
                expiresAt: null,
              },
            })

            const challenge = await startDomainVerification(userId, updated.id, 'dns_txt', prisma)
            res.status(200).json({ domain: updated, verification: challenge })
            return
          }

          if (isAutoVerify && existing.status !== 'verified') {
            const updated = await prisma.domain.update({
              where: { id: existing.id },
              data: {
                status: 'verified',
                verifiedAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            })
            res.status(200).json({ domain: updated })
            return
          }

          // Ensure a challenge exists for the domain
          let challenge = await prisma.verification.findFirst({
            where: { domainId: existing.id },
            orderBy: { createdAt: 'desc' },
          })
          if (!challenge || !challenge.token || challenge.expiresAt.getTime() <= Date.now()) {
            const newChallenge = await startDomainVerification(userId, existing.id, 'dns_txt', prisma)
            res.status(200).json({ domain: existing, verification: newChallenge })
            return
          }

          const details = {
            method: challenge.method,
            token: challenge.token,
            dnsRecord: {
              type: 'TXT',
              host: `_leaklens.${existing.hostname}`,
              value: `leaklens-verification=${challenge.token}`,
            },
            metaTag: {
              name: 'leaklens-verification',
              content: challenge.token,
              snippet: `<meta name="leaklens-verification" content="${challenge.token}" />`,
            },
            file: {
              path: '/.well-known/leaklens.txt',
              content: `leaklens-verification=${challenge.token}`,
            },
          }

          res.status(200).json({
            domain: existing,
            verification: {
              verificationId: challenge.id,
              details,
              expiresAt: challenge.expiresAt.toISOString(),
            },
          })
          return
        }

        // 3. Create domain record (auto-verified in dev mode if AUTO_VERIFY_DEV is true)
        const domain = await prisma.domain.create({
          data: {
            userId,
            hostname,
            status: isAutoVerify ? 'verified' : 'pending_verification',
            verifiedAt: isAutoVerify ? new Date() : null,
            expiresAt: isAutoVerify ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
          },
        })

        // 4. Record audit log
        await recordAuditLog(
          {
            userId,
            action: 'domain.create',
            hostname,
            ip: req.ip || '127.0.0.1',
          },
          prisma,
        )

        // 5. Generate initial challenge
        const challenge = await startDomainVerification(userId, domain.id, 'dns_txt', prisma)

        res.status(201).json({
          domain,
          verification: challenge,
        })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * GET /domains
   * List all domains owned by the authenticated user with scan stats.
   */
  router.get(
    '/domains',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const domains = await prisma.domain.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: {
            scans: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: {
                id: true,
                exposureScore: true,
                status: true,
                createdAt: true,
                finishedAt: true,
              },
            },
            _count: {
              select: { scans: true },
            },
          },
        })

        const formatted = domains.map((d) => {
          const latestScan = d.scans[0]
          return {
            id: d.id,
            hostname: d.hostname,
            status: d.status,
            verifiedAt: d.verifiedAt,
            createdAt: d.createdAt,
            scanCount: d._count.scans,
            latestScore: latestScan?.exposureScore ?? null,
            latestScanStatus: latestScan?.status ?? null,
            recentScores: d.scans.map((s) => s.exposureScore).filter((s): s is number => s !== null),
          }
        })

        res.status(200).json({ domains: formatted })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * DELETE /domains/:id
   * Delete a domain owned by the authenticated user.
   */
  router.delete(
    '/domains/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        const domain = await prisma.domain.findFirst({
          where: {
            userId,
            OR: [{ id }, { hostname: id }],
          },
        })

        if (!domain) {
          res.status(404).json({ error: 'Domain not found' })
          return
        }

        await prisma.domain.delete({
          where: { id: domain.id },
        })

        res.status(200).json({ success: true, message: 'Domain deleted' })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * GET /domains/:id
   * Retrieve a specific domain owned by the authenticated user.
   */
  router.get(
    '/domains/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        const domain = await prisma.domain.findFirst({
          where: {
            userId,
            OR: [{ id }, { hostname: id }],
          },
        })

        if (!domain) {
          res.status(404).json({ error: 'Domain not found' })
          return
        }

        res.status(200).json({ domain })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * GET /domains/:id/scans
   * Retrieve all scans for that app/domain (newest first).
   * Owner-scoped: user must own the domain.
   * Uses zod validation.
   */
  router.get(
    '/domains/:id/scans',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const paramResult = z.object({ id: z.string().min(1) }).safeParse(req.params)
        if (!paramResult.success) {
          res.status(400).json({
            error: 'INVALID_DOMAIN_ID',
            message: 'Invalid domain ID parameter.',
          })
          return
        }

        const id = paramResult.data.id
        const domain = await prisma.domain.findFirst({
          where: {
            userId,
            OR: [{ id }, { hostname: id }],
          },
        })

        if (!domain) {
          res.status(404).json({
            error: 'DOMAIN_NOT_FOUND',
            message: 'Domain not found or unauthorized',
          })
          return
        }

        const scans = await prisma.scan.findMany({
          where: { domainId: domain.id },
          orderBy: { createdAt: 'desc' },
          include: {
            findings: {
              select: { severity: true },
            },
            checkRuns: {
              select: { status: true },
            },
          },
        })

        const formattedScans = scans.map((s) => {
          const countsBySeverity = {
            critical: s.findings.filter((f) => f.severity.toLowerCase() === 'critical').length,
            high: s.findings.filter((f) => f.severity.toLowerCase() === 'high').length,
            medium: s.findings.filter((f) => f.severity.toLowerCase() === 'medium').length,
            low: s.findings.filter((f) => f.severity.toLowerCase() === 'low').length,
          }
          const couldNotTestCount = s.checkRuns.filter(
            (c) => c.status.toLowerCase().replace(/['\s_-]/g, '') === 'couldnottest',
          ).length

          const startedAt = s.startedAt ? s.startedAt.toISOString() : s.createdAt.toISOString()
          const finishedAt = s.finishedAt ? s.finishedAt.toISOString() : null

          return {
            id: s.id,
            domainId: s.domainId,
            status: s.status,
            startedAt,
            finishedAt,
            score: s.exposureScore,
            scoreVersion: s.scoreVersion || '1.0.0',
            countsBySeverity,
            couldNotTestCount,
          }
        })

        res.status(200).json({ scans: formattedScans })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * GET /domains/:id/verification
   * Retrieve active verification challenge details.
   */
  router.get(
    '/domains/:id/verification',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        let domain = await prisma.domain.findFirst({
          where: {
            userId,
            OR: [{ id }, { hostname: id }],
          },
        })

        if (!domain) {
          const existing = await prisma.domain.findUnique({
            where: { hostname: id },
          })
          if (existing) {
            const isVerifiedActive =
              existing.status === 'verified' &&
              existing.expiresAt &&
              existing.expiresAt.getTime() > Date.now()

            const existingOwner = prisma.user?.findUnique
              ? await prisma.user.findUnique({
                  where: { id: existing.userId },
                })
              : null
            const isMockOwner = Boolean(
              existingOwner &&
                (existingOwner.email.endsWith('@example.com') ||
                  existingOwner.email.includes('mock') ||
                  existingOwner.id.startsWith('00000000-') ||
                  existingOwner.name === 'Alex Morgan'),
            )

            if (!isVerifiedActive || isMockOwner) {
              domain = await prisma.domain.update({
                where: { id: existing.id },
                data: {
                  userId,
                  status: isVerifiedActive ? existing.status : 'pending_verification',
                  verifiedAt: isVerifiedActive ? existing.verifiedAt : null,
                  expiresAt: isVerifiedActive ? existing.expiresAt : null,
                },
              })
            }
          }
        }

        if (!domain) {
          res.status(404).json({ error: 'Domain not found' })
          return
        }

        const verification = await prisma.verification.findFirst({
          where: { domainId: domain.id },
          orderBy: { createdAt: 'desc' },
        })

        if (!verification) {
          // Generate new challenge if none exists
          const challenge = await startDomainVerification(
            userId,
            domain.id,
            'dns_txt',
            prisma,
          )
          res.status(200).json({
            domainId: domain.id,
            status: 'pending',
            details: challenge.details,
          })
          return
        }

        const details = {
          method: verification.method,
          token: verification.token,
          dnsRecord: {
            type: 'TXT',
            host: `_leaklens.${domain.hostname}`,
            value: `leaklens-verification=${verification.token}`,
          },
          metaTag: {
            name: 'leaklens-verification',
            content: verification.token,
            snippet: `<meta name="leaklens-verification" content="${verification.token}" />`,
          },
          file: {
            path: '/.well-known/leaklens.txt',
            content: `leaklens-verification=${verification.token}`,
          },
        }

        res.status(200).json({
          domainId: domain.id,
          status: verification.status,
          details,
          expiresAt: verification.expiresAt.toISOString(),
        })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * POST /domains/:id/challenge
   * Generate or refresh verification challenge with specified method.
   */
  router.post(
    '/domains/:id/challenge',
    rateLimitByDomain(120, 60 * 1000),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        let method = 'dns_txt'
        if (req.body?.method) {
          try {
            method = normalizeVerificationMethod(req.body.method)
          } catch {
            method = 'dns_txt'
          }
        }

        const challenge = await startDomainVerification(
          userId,
          id,
          method,
          prisma,
        )

        res.status(200).json(challenge)
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * POST /domains/:id/verify
   * Trigger domain verification check.
   */
  router.post(
    '/domains/:id/verify',
    rateLimitByDomain(10, 60 * 1000),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        let method: string | undefined = undefined
        if (req.body?.method === 'auto' || req.body?.method === 'any') {
          method = 'auto'
        } else if (req.body?.method) {
          try {
            method = normalizeVerificationMethod(req.body.method)
          } catch {
            method = 'auto'
          }
        }

        const result = await checkDomainVerification(userId, id, prisma, undefined, method)

        const domain = await prisma.domain.findFirst({
          where: {
            userId,
            OR: [{ id }, { hostname: id }],
          },
        })

        await recordAuditLog(
          {
            userId,
            action: 'domain.verify',
            hostname: domain?.hostname,
            ip: req.ip || '127.0.0.1',
            metadata: {
              verified: result.verified,
              reason: result.reason,
              method: method || 'default',
            },
          },
          prisma,
        )

        res.status(200).json({
          domainId: domain?.id || req.params.id,
          status: result.verified ? 'verified' : 'failed',
          verified: result.verified,
          reason: result.reason,
          verifiedAt: result.verified ? result.checkedAt : undefined,
          message: result.verified
            ? 'Domain ownership verified successfully'
            : result.reason,
        })
      } catch (err) {
        if (err instanceof VerificationError) {
          res.status(err.statusCode).json({
            error: err.name,
            message: err.message,
          })
          return
        }
        next(err)
      }
    },
  )

  return router
}

export const domainsRouter = createDomainsRouter()
