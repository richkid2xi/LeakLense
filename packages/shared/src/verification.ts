import { z } from "zod";

export const VerificationMethodSchema = z.enum(["dns_txt", "meta_tag", "file"]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const VerificationStatusSchema = z.enum(["pending", "verified", "failed", "expired"]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

/**
 * Normalizes input verification methods at API or adapter boundaries
 * to the canonical VerificationMethod type.
 */
export function normalizeVerificationMethod(method: string): VerificationMethod {
  if (method === "dns" || method === "dns_txt") return "dns_txt";
  if (method === "meta" || method === "meta_tag") return "meta_tag";
  if (method === "file") return "file";
  throw new Error(`Invalid verification method: ${method}`);
}

export const VerificationSchema = z.object({
  id: z.string().uuid(),
  domainId: z.string().uuid(),
  method: VerificationMethodSchema,
  token: z.string().min(16),
  tokenHash: z.string().optional(),
  tokenPreview: z.string().optional(),
  status: VerificationStatusSchema.default("pending"),
  attempts: z.number().int().nonnegative().default(0),
  lastError: z.string().nullable().optional(),
  verifiedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Verification = z.infer<typeof VerificationSchema>;

export const StartVerificationInputSchema = z.object({
  method: VerificationMethodSchema.default("dns_txt"),
});

export type StartVerificationInput = z.infer<typeof StartVerificationInputSchema>;

export const VerificationDetailsSchema = z.object({
  method: VerificationMethodSchema,
  token: z.string(),
  dnsRecord: z.object({
    type: z.literal("TXT"),
    host: z.string(), // e.g., _leaklens or _leaklens.example.com
    value: z.string(), // e.g., leaklens-verification=ll_...
  }),
  metaTag: z.object({
    name: z.literal("leaklens-verification"),
    content: z.string(),
    snippet: z.string(), // <meta name="leaklens-verification" content="..." />
  }),
  file: z.object({
    path: z.literal("/.well-known/leaklens.txt"),
    content: z.string(),
  }),
});

export type VerificationDetails = z.infer<typeof VerificationDetailsSchema>;
