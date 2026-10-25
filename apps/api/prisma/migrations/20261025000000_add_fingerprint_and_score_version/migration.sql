-- AlterTable
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "findings_fingerprint_idx" ON "findings"("fingerprint");

-- AlterTable
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "scoreVersion" TEXT DEFAULT '1.0.0';
