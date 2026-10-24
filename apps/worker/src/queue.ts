import PgBoss from "pg-boss";
import { getDetectors } from "./detectors/registry";

export const RUN_SCAN_JOB = "run-scan";

export interface RunScanJobData {
  scanId: string;
  domainId: string;
  verifiedHostname: string;
}

export async function createWorkerQueue(connectionString?: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: connectionString || process.env.DATABASE_URL || "postgres://localhost:5432/leaklens",
  });

  boss.on("error", (error) => {
    console.error("pg-boss worker error:", error);
  });

  return boss;
}

/**
 * Register the "run-scan" job handler
 */
export async function registerScanWorker(boss: PgBoss): Promise<void> {
  await boss.work<RunScanJobData>(RUN_SCAN_JOB, async (jobs) => {
    const jobList = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of jobList) {
      const { scanId, verifiedHostname } = job.data;
      console.log(`[Worker] Starting job for scan ${scanId} on ${verifiedHostname}`);

      const detectors = getDetectors();
      console.log(`[Worker] Running scan with ${detectors.length} registered detectors (empty in Phase 0)`);
    }

    return;
  });
}
