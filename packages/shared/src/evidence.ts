import { z } from "zod";

export const EvidenceKindSchema = z.enum(["key", "table", "bucket", "file", "network"]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const MaskedEvidenceSchema = z.object({
  kind: EvidenceKindSchema.default("key"),
  maskedValue: z.string().optional(),
  location: z.string(), // e.g. /assets/index-a81c.js or /.env
  summary: z.string().optional(),
  snippet: z.string().optional(),
  columnNames: z.array(z.string()).optional(), // Only schema metadata, never row data
  httpStatus: z.number().int().optional(),
});

export type MaskedEvidence = z.infer<typeof MaskedEvidenceSchema>;

/**
 * Mask a secret string strictly according to the LeakLens security rules:
 * - Keep prefix (e.g. "sk_live_" or "sk-proj-")
 * - Mask all middle characters with bullets
 * - Keep only the last 4 characters
 * - Never return, log, or store raw secrets
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length <= 8) {
    return "••••••••";
  }

  const prefixMatch = secret.match(/^([a-zA-Z0-9_-]{3,12}_|[a-zA-Z0-9_-]{2,8}-)/);
  const prefix = prefixMatch ? prefixMatch[1] : secret.slice(0, Math.min(7, secret.length - 4));
  const suffix = secret.slice(-4);

  return `${prefix}••••••••••••${suffix}`;
}
