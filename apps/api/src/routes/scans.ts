import { Router, type Request, type Response, type NextFunction } from 'express'
import type { PrismaClient } from '@prisma/client'
import { CreateScanInputSchema } from '@leaklens/shared'
import { getPrismaClient } from '../db'
import { recordAuditLog } from '../modules/audit'
import { assertDomainScanEligible, VerificationError } from '../modules/verification'
import { rateLimitByDomain, rateLimitByUser } from '../middleware/rateLimit'

export type ScanEnqueuer = (data: {
  scanId: string
  domainId: string
  verifiedHostname: string
}) => Promise<void>

export function createScansRouter(
  prismaClient?: PrismaClient,
  scanEnqueuer?: ScanEnqueuer,
): Router {
  const router = Router()
  const prisma = prismaClient || getPrismaClient()

  /**
   * POST /scans
   * Enqueue a new scan for a verified domain.
   *
   * Requirements:
   * - User must be authenticated and email-verified (Amendment f).
   * - Strictly requires authorized: true (ownership confirmation recorded in audit log).
   * - Scoped to user: user must own domain.
   * - Domain must be verified and not expired (<= 30 days) (Amendment e & h).
   */
  router.post(
    '/scans',
    rateLimitByUser(20, 60 * 1000),
    rateLimitByDomain(5, 60 * 1000),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id

        // 1. Enforce email verification before scanning (Amendment f)
        if (req.user?.emailVerified === false) {
          res.status(403).json({
            error: 'EMAIL_VERIFICATION_REQUIRED',
            message:
              'Email-verified accounts are required before scanning. Please verify your email address.',
          })
          return
        }

        // 2. Validate input and ensure "I own this site" confirmation is present
        const parseResult = CreateScanInputSchema.safeParse(req.body)
        if (!parseResult.success) {
          res.status(400).json({
            error: 'INVALID_SCAN_REQUEST',
            message: 'You must confirm you own this site, or are authorised to scan it.',
            details: parseResult.error.format(),
          })
          return
        }

        const { domainId } = parseResult.data

        // 3. Ownership and 30-day verification expiry check (Amendment e & h)
        const { domain } = await assertDomainScanEligible(domainId, userId, prisma)

        // 4. Record "I own this site" authorization and scan start in audit log (Amendment f)
        await recordAuditLog(
          {
            userId,
            action: 'scan.authorize_ownership',
            hostname: domain.hostname,
            ip: req.ip || '127.0.0.1',
            metadata: {
              domainId,
              authorized: true,
              statement:
                'User affirmed ownership or explicit authorization to scan this domain.',
            },
          },
          prisma,
        )

        // 5. Create scan in Prisma
        const scan = await prisma.scan.create({
          data: {
            domainId: domain.id,
            status: 'pending',
          },
        })

        // 6. Enqueue scan job into worker queue
        if (scanEnqueuer) {
          await scanEnqueuer({
            scanId: scan.id,
            domainId: domain.id,
            verifiedHostname: domain.hostname,
          })
        }

        res.status(202).json({
          scan,
          message: 'Scan enqueued into worker queue',
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

  /**
   * GET /scans
   * List all scans for domains owned by the authenticated user.
   */
  router.get(
    '/scans',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const scans = await prisma.scan.findMany({
          where: {
            domain: { userId },
          },
          orderBy: { createdAt: 'desc' },
          include: {
            domain: {
              select: { hostname: true },
            },
          },
        })

        res.status(200).json({ scans })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * GET /scans/:id
   * Retrieve scan details, check runs, and metrics for a user-owned scan.
   */
  router.get(
    '/scans/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        const scan = await prisma.scan.findFirst({
          where: {
            id,
            domain: { userId },
          },
          include: {
            checkRuns: true,
            domain: {
              select: { hostname: true },
            },
          },
        })

        if (!scan) {
          res.status(404).json({ error: 'Scan not found or access denied.' })
          return
        }

        const { checkRuns, ...scanDetails } = scan

        res.status(200).json({
          scan: scanDetails,
          checksRun: checkRuns,
        })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * GET /scans/:id/findings
   * Retrieve findings for a user-owned scan.
   */
  router.get(
    '/scans/:id/findings',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const id = String(req.params.id)
        const scan = await prisma.scan.findFirst({
          where: {
            id,
            domain: { userId },
          },
        })

        if (!scan) {
          res.status(404).json({ error: 'Scan not found or access denied.' })
          return
        }

        const findings = await prisma.finding.findMany({
          where: { scanId: scan.id },
          orderBy: { severity: 'asc' },
        })

        res.status(200).json({ findings })
      } catch (err) {
        next(err)
      }
    },
  )

  return router
}

export const scansRouter = createScansRouter()
