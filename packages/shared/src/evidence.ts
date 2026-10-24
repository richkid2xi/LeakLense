import { z } from "zod";

export const EvidenceKindSchema = z.enum(["key", "table", "bucket", "file", "network"]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const MaskedEvidenceSchema = z.object({
  kind: EvidenceKindSchema,
  maskedValue: z.string(),
  location: z.string(), // e.g. /assets/index-a81c.js or supabase/public/profiles
  snippet: z.string().optional(),
  columnNames: z.array(z.string()).optional(), // Only schema metadata, never row data
  httpStatus: z.number().int().optional(),
});

export type MaskedEvidence = z.infer<typeof MaskedEvidenceSchema>;

/**
 * Mask a secret string strictly according to the LeakLens security rules:
 * - Keep prefix (up to 8 chars before underscore/delimiter)
 * - Mask all middle characters with bullets (••••)
 * - Keep only the last 4 characters
 * - Never return or store raw secret
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length <= 8) {
    return "••••••••";
  }

  // Look for prefix pattern like "sk_live_" or "ghp_" or "sb_publishable_"
  const prefixMatch = secret.match(/^([a-zA-Z0-9_-]{3,12}_)/);
  const prefix = prefixMatch ? prefixMatch[1] : secret.slice(0, 4);
  const suffix = secret.slice(-4);

  return `${prefix}••••••••••••${suffix}`;
}
