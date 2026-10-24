import { z } from "zod";

export const ScanStatusSchema = z.enum(["pending", "running", "completed", "failed"]);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

export const ScanStepStatusSchema = z.enum(["waiting", "checking", "complete", "failed"]);
export type ScanStepStatus = z.infer<typeof ScanStepStatusSchema>;

export const ScanStepSchema = z.object({
  id: z.number().int().min(1).max(10),
  name: z.string(),
  message: z.string().optional(),
  status: ScanStepStatusSchema,
});

export type ScanStep = z.infer<typeof ScanStepSchema>;

export const DetectedStackSchema = z.array(z.string());
export type DetectedStack = z.infer<typeof DetectedStackSchema>;

export const ScanSchema = z.object({
  id: z.string().uuid(),
  domainId: z.string().uuid(),
  status: ScanStatusSchema.default("pending"),
  startedAt: z.coerce.date().nullable().optional(),
  finishedAt: z.coerce.date().nullable().optional(),
  detectedStack: DetectedStackSchema.default([]),
  exposureScore: z.number().min(0).max(100).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Scan = z.infer<typeof ScanSchema>;

export const CreateScanInputSchema = z.object({
  domainId: z.string().uuid(),
  authorized: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you own this site, or are authorised to scan it." }),
  }),
  builderHint: z.enum(["Lovable", "Bolt", "Cursor", "v0", "Other"]).optional(),
  selectedChecks: z.array(z.string()).optional(),
});

export type CreateScanInput = z.infer<typeof CreateScanInputSchema>;
