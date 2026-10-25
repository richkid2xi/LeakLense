import PgBoss from 'pg-boss'
import { PrismaClient } from '@prisma/client'
import { computeFindingFingerprint } from '@leaklens/shared'
import { runScan as defaultRunScan } from './pipeline/engine'

export const RUN_SCAN_JOB = 'run-scan'

export interface RunScanJobData {
  scanId: string
  domainId: string
  verifiedHostname: string
  targetUrl?: string
}

export async function createWorkerQueue(connectionString?: string): Promise<PgBoss> {
  const conn =
    connectionString || process.env.DATABASE_URL || 'postgres://localhost:5432/leaklens'
  const isSsl = conn.includes('sslmode=require') || conn.includes('supabase.com')
  const sanitizedConn = isSsl ? conn.replace(/[?&]sslmode=[^&]+/, '') : conn
  const boss = new PgBoss({
    connectionString: sanitizedConn,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
  })

  boss.on('error', error => {
    console.error('pg-boss worker error:', error)
  })

  return boss
}

/**
 * Processes a single scan job. Re-verifies domain ownership and expiry,
 * executes the scan engine, and persists CheckRuns, Findings, and Metrics to Prisma.
 */
export async function processScanJob(
  jobData: RunScanJobData,
  prisma: PrismaClient,
  scanRunner = defaultRunScan,
): Promise<void> {
  const { scanId, domainId, verifiedHostname, targetUrl } = jobData
  const target = targetUrl || `https://${verifiedHostname}`

  // 0. Ensure scan exists and is not already completed
  if (prisma.scan?.findUnique) {
    const currentScan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { status: true },
    })
    if (currentScan?.status === 'completed') {
      return
    }
  }

  // 1. Fetch domain and re-validate verification status & 30-day expiry (Amendment e)
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
  })

  if (!domain) {
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'failed',
        errorMessage: `Domain with ID ${domainId} was not found.`,
      },
    })
    return
  }

  const isVerified = domain.status === 'verified' && Boolean(domain.verifiedAt)
  const isExpired = !domain.expiresAt || domain.expiresAt.getTime() <= Date.now()

  if (!isVerified || isExpired) {
    const reason = !isVerified
      ? `Domain '${domain.hostname}' is not verified. Complete ownership verification before initiating a scan.`
      : `Verification for domain '${domain.hostname}' has expired (30-day limit). Re-verify ownership before scanning.`

    if (isVerified && isExpired) {
      await prisma.domain.update({
        where: { id: domain.id },
        data: { status: 'expired' },
      })
    }

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'failed',
        errorMessage: reason,
      },
    })
    return
  }

  // 2. Mark scan as running
  await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: 'running',
      startedAt: new Date(),
      errorMessage: null,
    },
  })

  try {
    // 3. Execute scan engine with stage tracking
    const onProgress = async (stage: string, stepIndex: number) => {
      try {
        await prisma.scan.update({
          where: { id: scanId },
          data: {
            metrics: {
              stage,
              stepIndex,
            },
          },
        })
      } catch {
        // Non-blocking progress update
      }
    }

    const result = await scanRunner(target, verifiedHostname, { onProgress })

    // 4. Persist check runs
    for (const check of result.checks) {
      await prisma.checkRun.create({
        data: {
          scanId,
          checkId: check.id ?? check.checkId ?? 'LL-UNKNOWN',
          title: check.label ?? check.title ?? check.id ?? 'Security Check',
          status: check.status,
          reason: check.reason ?? null,
        },
      })
    }

    // 5. Persist findings (strictly masked evidence only)
    for (const finding of result.findings) {
      const fingerprint =
        (finding as any).fingerprint ||
        computeFindingFingerprint(verifiedHostname, finding)

      await prisma.finding.create({
        data: {
          scanId,
          type: finding.type,
          fingerprint,
          severity: finding.severity,
          status: finding.status,
          location: finding.location,
          title: finding.title,
          meaning: finding.meaning,
          why: finding.why,
          maskedEvidence: finding.maskedEvidence as any,
          technicalSteps: finding.technicalSteps as any,
          verificationSteps: finding.verificationSteps as any,
          references: finding.references as any,
          metadata: finding.metadata as any,
        },
      })
    }

    // 6. Complete scan record
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        detectedStack: result.detectedStack,
        exposureScore: result.exposureScore,
        scoreVersion: (result as any).scoreVersion || '1.0.0',
        metrics: result.metrics,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown scan pipeline error'
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'failed',
        errorMessage: message,
      },
    })
  }
}

/**
 * Registers the pg-boss scan worker listener.
 */
export async function registerScanWorker(
  boss: PgBoss,
  prismaClient?: PrismaClient,
): Promise<void> {
  const prisma = prismaClient || new PrismaClient()

  await boss.work<RunScanJobData>(RUN_SCAN_JOB, async jobs => {
    const jobList = Array.isArray(jobs) ? jobs : [jobs]
    for (const job of jobList) {
      await processScanJob(job.data, prisma)
    }
  })
}
