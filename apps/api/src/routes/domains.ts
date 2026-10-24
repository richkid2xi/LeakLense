import { Router, type Request, type Response, type NextFunction } from 'express'
import type { PrismaClient } from '@prisma/client'
import {
  CreateDomainInputSchema,
  StartVerificationInputSchema,
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

        if (existing) {
          if (existing.userId !== userId) {
            res.status(409).json({
              error: 'DOMAIN_CONFLICT',
              message:
                'This domain is already registered. If you are the rightful owner, please contact support.',
            })
            return
          }

          res.status(200).json({ domain: existing })
          return
        }

        // 3. Create domain record
        const domain = await prisma.domain.create({
          data: {
            userId,
            hostname,
            status: 'pending_verification',
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
   * List all domains owned by the authenticated user.
   */
  router.get(
    '/domains',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const domains = await prisma.domain.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        })

        res.status(200).json({ domains })
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
          where: { id, userId },
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
   * GET /domains/:id/verification
   * Retrieve active verification challenge details.
   */
  router.get(
    '/domains/:id/verification',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        const domain = await prisma.domain.findFirst({
          where: { id, userId },
        })

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
    rateLimitByDomain(10, 60 * 1000),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        const parseResult = StartVerificationInputSchema.safeParse(req.body)
        const method = parseResult.success ? parseResult.data.method : 'dns_txt'

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
        const result = await checkDomainVerification(userId, id, prisma)

        const domain = await prisma.domain.findUnique({
          where: { id },
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
            },
          },
          prisma,
        )

        res.status(200).json({
          domainId: req.params.id,
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
