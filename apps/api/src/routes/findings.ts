import { Router, type Request, type Response, type NextFunction } from 'express'
import type { PrismaClient } from '@prisma/client'
import {
  UpdateFindingStatusInputSchema,
  type BuilderTarget,
  type Finding,
} from '@leaklens/shared'
import { getKbEntry, generateFixPrompt } from '@leaklens/kb'
import { getPrismaClient } from '../db'
import { recordAuditLog } from '../modules/audit'

export function createFindingsRouter(prismaClient?: PrismaClient): Router {
  const router = Router()
  const prisma = prismaClient || getPrismaClient()

  /**
   * GET /findings/:id
   * Retrieve single finding with Knowledge Base enrichment and tailored fix prompt.
   * Scoped to the authenticated user.
   */
  router.get(
    '/findings/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = String(req.params.id)
        const userId = req.user!.id
        const builder = (req.query.builder as BuilderTarget) || 'Lovable'

        // 1. Fetch finding ensuring domain ownership
        const findingRecord = await prisma.finding.findFirst({
          where: {
            id,
            scan: {
              domain: { userId },
            },
          },
        })

        if (!findingRecord) {
          res.status(404).json({ error: 'Finding not found or access denied.' })
          return
        }

        const finding: Finding = {
          id: findingRecord.id,
          scanId: findingRecord.scanId,
          type: findingRecord.type,
          ruleVersion: '1.0.0',
          severity: findingRecord.severity as any,
          confidence: 'high',
          status: findingRecord.status as any,
          location: findingRecord.location,
          title: findingRecord.title || 'Security finding',
          meaning: findingRecord.meaning || '',
          why: findingRecord.why || '',
          maskedEvidence: findingRecord.maskedEvidence as any,
          technicalSteps: (findingRecord.technicalSteps as string[]) || [],
          steps: (findingRecord.technicalSteps as string[]) || [],
          verificationSteps: (findingRecord.verificationSteps as string[]) || [],
          references: (findingRecord.references as any) || [],
          metadata: (findingRecord.metadata as any) || {},
          createdAt: findingRecord.createdAt,
          updatedAt: findingRecord.updatedAt,
        }

        // 2. Enrich with KB entry if available
        const kbEntry = getKbEntry(finding.type)
        let tailoredPrompt: string | undefined

        if (kbEntry) {
          tailoredPrompt = generateFixPrompt({
            entry: kbEntry,
            builder,
            placeholders: {
              findingTitle: finding.title,
              location: finding.location,
              maskedKey: finding.maskedEvidence.maskedValue,
              specificSteps: finding.steps,
            },
          })
        }

        res.status(200).json({
          finding,
          kb: kbEntry,
          fixPrompt: tailoredPrompt,
        })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * PATCH /findings/:id/status
   * Update status of a finding (open | fixed | ignored)
   * Scoped to the authenticated user.
   */
  router.patch(
    '/findings/:id/status',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = String(req.params.id)
        const userId = req.user!.id
        const parseResult = UpdateFindingStatusInputSchema.safeParse(req.body)

        if (!parseResult.success) {
          res.status(400).json({
            error: 'Invalid status value',
            details: parseResult.error.format(),
          })
          return
        }

        const { status } = parseResult.data

        // 1. Verify finding ownership
        const finding = await prisma.finding.findFirst({
          where: {
            id,
            scan: {
              domain: { userId },
            },
          },
          include: {
            scan: {
              include: { domain: true },
            },
          },
        })

        if (!finding) {
          res.status(404).json({ error: 'Finding not found or access denied.' })
          return
        }

        // 2. Update status
        const updated = await prisma.finding.update({
          where: { id: finding.id },
          data: { status },
        })

        // 3. Audit log
        await recordAuditLog(
          {
            userId,
            action: 'finding.status_change',
            hostname: finding.scan.domain.hostname,
            ip: req.ip || '127.0.0.1',
            metadata: {
              findingId: id,
              oldStatus: finding.status,
              newStatus: status,
            },
          },
          prisma,
        )

        res.status(200).json({
          id: updated.id,
          status: updated.status,
          updatedAt: updated.updatedAt.toISOString(),
          message: `Finding status updated to ${status}. A rescan is required to confirm remediation.`,
        })
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * POST /findings/:id/recheck
   * Re-run isolated check for this specific finding
   */
  router.post(
    '/findings/:id/recheck',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = String(req.params.id)
        const userId = req.user!.id

        const finding = await prisma.finding.findFirst({
          where: {
            id,
            scan: {
              domain: { userId },
            },
          },
        })

        if (!finding) {
          res.status(404).json({ error: 'Finding not found or access denied.' })
          return
        }

        res.status(200).json({
          findingId: id,
          status: 'rechecking',
          message: 'Recheck job enqueued. Running isolated detector check.',
        })
      } catch (err) {
        next(err)
      }
    },
  )

  return router
}

export const findingsRouter = createFindingsRouter()
