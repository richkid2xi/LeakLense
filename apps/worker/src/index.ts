import dotenv from "dotenv";
dotenv.config();

import { createWorkerQueue, registerScanWorker } from "./queue";

async function main() {
  console.log("LeakLens Worker initializing...");

  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set. Running worker in standby mode (scaffolding).");
    return;
  }

  try {
    const boss = await createWorkerQueue(process.env.DATABASE_URL);
    await boss.start();
    await registerScanWorker(boss);
    console.log("LeakLens Worker listening for 'run-scan' jobs.");
  } catch (error) {
    console.error("Failed to start worker queue:", error);
  }
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
