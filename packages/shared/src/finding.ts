import { z } from "zod";
import { MaskedEvidenceSchema } from "./evidence";

export const FindingSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingConfidenceSchema = z.enum(["confirmed", "high", "possible"]);
export type FindingConfidence = z.infer<typeof FindingConfidenceSchema>;

export const FindingStatusSchema = z.enum(["open", "fixed", "ignored"]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const FindingReferenceSchema = z.object({
  title: z.string(),
  url: z.string(),
});
export type FindingReference = z.infer<typeof FindingReferenceSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  scanId: z.string().optional(),
  type: z.string().min(1), // Rule identifier, e.g. "LL-SECRET-OPENAI", "LL-KEY-001"
  fingerprint: z.string().optional(),
  ruleVersion: z.string().default("1.0.0").optional(),
  severity: FindingSeveritySchema,
  confidence: FindingConfidenceSchema.default("high").optional(),
  status: FindingStatusSchema.default("open"),
  location: z.string(),
  title: z.string(),
  meaning: z.string(), // Plain English summary of the finding
  why: z.string(), // Why this finding matters and realistic consequences
  maskedEvidence: MaskedEvidenceSchema,
  technicalSteps: z.array(z.string()).default([]).optional(),
  steps: z.array(z.string()).default([]), // Backward-compatible alias for technicalSteps
  verificationSteps: z.array(z.string()).default([]).optional(),
  references: z.array(FindingReferenceSchema).default([]).optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type Finding = z.infer<typeof FindingSchema>;

export const UpdateFindingStatusInputSchema = z.object({
  status: FindingStatusSchema,
});

export type UpdateFindingStatusInput = z.infer<typeof UpdateFindingStatusInputSchema>;
