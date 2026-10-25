import type { PrismaClient } from '@prisma/client'
import { computeFindingFingerprint } from '@leaklens/shared'

/**
 * Backfills finding fingerprints for existing database rows where fingerprint is missing.
 * Recomputes deterministically from stored fields (domain hostname, type, location, maskedEvidence).
 */
export async function backfillFindingFingerprints(prisma: PrismaClient): Promise<{ updatedCount: number }> {
  const missingFindings = await prisma.finding.findMany({
    where: {
      fingerprint: null,
    },
    include: {
      scan: {
        include: {
          domain: {
            select: {
              hostname: true,
            },
          },
        },
      },
    },
    take: 500,
  })

  let updatedCount = 0

  for (const finding of missingFindings) {
    const hostname = finding.scan?.domain?.hostname || 'unknown-host'
    const fingerprint = computeFindingFingerprint(hostname, {
      type: finding.type,
      location: finding.location,
      maskedEvidence: finding.maskedEvidence as any,
      metadata: finding.metadata as any,
    })

    await prisma.finding.update({
      where: { id: finding.id },
      data: { fingerprint },
    })
    updatedCount++
  }

  return { updatedCount }
}
