import { z } from "zod";
import { FindingSeveritySchema } from "@leaklens/shared";

export const KbPromptTemplateSchema = z.object({
  lovable: z.string(),
  bolt: z.string(),
  cursor: z.string(),
  v0: z.string(),
  any_agent: z.string(),
});

export type KbPromptTemplate = z.infer<typeof KbPromptTemplateSchema>;

export const KbEntrySchema = z.object({
  id: z.string().regex(/^LL-[A-Z]+-\d{3}$/, "ID must match format LL-TYPE-001"),
  title: z.string().min(5).max(150),
  category: z.enum(["Secrets", "Database", "Storage", "Configuration", "Network"]),
  defaultSeverity: FindingSeveritySchema,
  plainEnglishExplanation: z.string().min(20),
  realisticConsequence: z.string().min(20),
  howItHappensInAiApps: z.string().min(20),
  severityLogic: z.string().min(20),
  fixSteps: z.array(z.string().min(5)).min(1),
  preventionChecklist: z.array(z.string().min(5)).min(1),
  fixPromptTemplates: KbPromptTemplateSchema,
});

export type KbEntry = z.infer<typeof KbEntrySchema>;
