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
   * GET /scans/compare
   * Compares the latest scan with the previous scan for the user or a given domain.
   */
  router.get(
    '/scans/compare',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id
        const domainId = req.query.domainId as string | undefined
        const scanId = req.query.scanId as string | undefined

        const whereClause: any = { domain: { userId } }
        if (domainId) {
          whereClause.domainId = domainId
        }

        const userScans = await prisma.scan.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          include: {
            findings: true,
            domain: { select: { hostname: true } },
          },
          take: 5,
        })

        if (userScans.length === 0) {
          res.status(200).json({
            comparison: {
              beforeDate: 'None',
              beforeScore: 100,
              afterDate: 'Today',
              afterScore: 100,
              resolvedCount: 0,
              resolvedSummary: 'No scans recorded yet.',
              newCount: 0,
              newSummary: 'No scans recorded yet.',
              headline: 'No scan history yet.',
            },
          })
          return
        }

        let afterScan = userScans[0]!
        if (scanId) {
          const matched = userScans.find((s) => s.id === scanId)
          if (matched) afterScan = matched
        }

        const beforeScan = userScans.find(
          (s) => s.id !== afterScan.id && s.domainId === afterScan.domainId && s.status === 'completed'
        )

        const afterDate = afterScan.finishedAt || afterScan.createdAt
        const formattedAfterDate = new Date(afterDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        const afterScore = afterScan.exposureScore ?? (afterScan.findings.length === 0 ? 100 : 80)

        if (!beforeScan) {
          const newCount = afterScan.findings.length
          const newSummary =
            newCount > 0
              ? `${newCount} finding${newCount > 1 ? 's' : ''} recorded in baseline scan.`
              : 'Zero exposures detected in initial scan.'

          res.status(200).json({
            comparison: {
              beforeDate: 'Baseline',
              beforeScore: afterScore,
              afterDate: formattedAfterDate,
              afterScore: afterScore,
              resolvedCount: 0,
              resolvedSummary: 'First scan recorded. Future rescans will show resolved and new items.',
              newCount,
              newSummary,
              headline: newCount === 0 ? 'Clean baseline report.' : 'Initial baseline scan complete.',
            },
          })
          return
        }

        const beforeDate = beforeScan.finishedAt || beforeScan.createdAt
        const formattedBeforeDate = new Date(beforeDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        const beforeScore = beforeScan.exposureScore ?? (beforeScan.findings.length === 0 ? 100 : 80)

        const beforeFindingKeys = new Set(beforeScan.findings.map((f) => `${f.type}::${f.location}`))
        const afterFindingKeys = new Set(afterScan.findings.map((f) => `${f.type}::${f.location}`))

        const resolved = beforeScan.findings.filter((f) => !afterFindingKeys.has(`${f.type}::${f.location}`))
        const newFindings = afterScan.findings.filter((f) => !beforeFindingKeys.has(`${f.type}::${f.location}`))

        const resolvedCount = resolved.length
        const newCount = newFindings.length

        const resolvedSummary =
          resolvedCount > 0
            ? resolved.map((f) => f.title).slice(0, 3).join(', ') + (resolvedCount > 3 ? ` and ${resolvedCount - 3} more.` : '.')
            : 'No resolved findings since the previous scan.'

        const newSummary =
          newCount > 0
            ? newFindings.map((f) => f.title).slice(0, 3).join(', ') + (newCount > 3 ? ` and ${newCount - 3} more.` : '.')
            : 'No new exposures detected in this rescan.'

        let headline = 'Exposure score unchanged.'
        if (afterScore > beforeScore) {
          headline = 'Fewer exposures than previous scan.'
        } else if (afterScore < beforeScore) {
          headline = 'More exposures than previous scan.'
        } else if (afterScore === 100 && beforeScore === 100) {
          headline = 'Clean report maintained.'
        }

        res.status(200).json({
          comparison: {
            beforeDate: formattedBeforeDate,
            beforeScore,
            afterDate: formattedAfterDate,
            afterScore,
            resolvedCount,
            resolvedSummary,
            newCount,
            newSummary,
            headline,
          },
        })
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
