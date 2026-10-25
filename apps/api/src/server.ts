import dotenv from "dotenv";
dotenv.config();

import PgBoss from "pg-boss";
import { createApp } from "./app";
import { getPrismaClient } from "./db";
import { registerScanWorker, processScanJob } from "@leaklens/worker";

const port = process.env.PORT || 3001;

async function bootstrap() {
  const prisma = getPrismaClient();

  // Direct execution fallback if pg-boss is unavailable or to guarantee immediate scanning
  let scanEnqueuer = async (data: { scanId: string; domainId: string; verifiedHostname: string }) => {
    setImmediate(async () => {
      try {
        console.log(`[Scan Engine] Running scan directly for ${data.verifiedHostname} (scanId: ${data.scanId})`);
        await processScanJob(data, prisma);
      } catch (err) {
        console.error(`[Scan Engine] Scan failed for ${data.verifiedHostname}:`, err);
      }
    });
  };

  if (process.env.DATABASE_URL) {
    try {
      const isSsl = process.env.DATABASE_URL.includes("sslmode=require") || process.env.DATABASE_URL.includes("supabase.com");
      const sanitizedConn = isSsl ? process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, '') : process.env.DATABASE_URL;
      const boss = new PgBoss({
        connectionString: sanitizedConn,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      });
      boss.on("error", (error) => console.error("pg-boss queue error:", error));
      await boss.start();
      console.log("pg-boss connected to scan queue.");

      // Register worker inside the API server so scans run reliably without requiring a separate process
      await registerScanWorker(boss, prisma);
      console.log("pg-boss scan worker registered in API server.");

      scanEnqueuer = async (data: { scanId: string; domainId: string; verifiedHostname: string }) => {
        try {
          await boss.send("run-scan", data);
        } catch {
          // Fall back to direct execution if boss send fails
          setImmediate(() => processScanJob(data, prisma).catch(console.error));
        }
      };
    } catch (err) {
      console.warn("Could not connect pg-boss queue, proceeding with direct background execution:", err);
    }
  }

  const app = createApp({ prisma, scanEnqueuer });

  app.listen(port, () => {
    console.log(`LeakLens API server running on port ${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start LeakLens API:", err);
  process.exit(1);
});
