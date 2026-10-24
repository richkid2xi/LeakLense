import { z } from "zod";
import { MaskedEvidenceSchema } from "./evidence";

export const FindingSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingStatusSchema = z.enum(["open", "fixed", "ignored"]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const FindingSchema = z.object({
  id: z.string().uuid(),
  scanId: z.string().uuid(),
  type: z.string().min(1),
  severity: FindingSeveritySchema,
  status: FindingStatusSchema.default("open"),
  location: z.string(),
  title: z.string(),
  meaning: z.string(),
  why: z.string(),
  maskedEvidence: MaskedEvidenceSchema,
  metadata: z.record(z.unknown()).default({}),
  steps: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Finding = z.infer<typeof FindingSchema>;

export const UpdateFindingStatusInputSchema = z.object({
  status: FindingStatusSchema,
});

export type UpdateFindingStatusInput = z.infer<typeof UpdateFindingStatusInputSchema>;
