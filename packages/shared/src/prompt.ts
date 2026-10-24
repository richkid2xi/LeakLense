import { z } from "zod";

export const BuilderTargetSchema = z.enum(["Lovable", "Bolt", "Cursor", "v0", "Any agent"]);
export type BuilderTarget = z.infer<typeof BuilderTargetSchema>;

// Strict sanitization regexes to avoid prompt injection when generating agent instructions
export const SafeIdentifierRegex = /^[a-zA-Z0-9_\-\.\/]{1,100}$/;
export const SafeTableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
export const SafeBucketNameRegex = /^[a-z0-9\.\-]{3,63}$/;

export const PromptPlaceholdersSchema = z.object({
  findingTitle: z.string().max(200),
  location: z.string().regex(SafeIdentifierRegex, "Location must be a safe path or identifier"),
  tableName: z.string().regex(SafeTableNameRegex).optional(),
  bucketName: z.string().regex(SafeBucketNameRegex).optional(),
  maskedKey: z.string().max(64).optional(),
  specificSteps: z.array(z.string()).default([]),
});

export type PromptPlaceholders = z.infer<typeof PromptPlaceholdersSchema>;

export const FixPromptSchema = z.object({
  builder: BuilderTargetSchema,
  prompt: z.string(),
  placeholders: PromptPlaceholdersSchema,
});

export type FixPrompt = z.infer<typeof FixPromptSchema>;

export const BUILDER_PROMPT_LEADS: Record<BuilderTarget, string> = {
  Lovable: "Update this Lovable project and apply the following security fix without changing the current UI:",
  Bolt: "In this Bolt app, make the smallest scoped code and configuration changes required to:",
  Cursor: "Inspect the relevant files in this Cursor workspace, then implement and verify this fix:",
  v0: "Update the server-side implementation for this v0 app. Do not expose secrets to client components:",
  "Any agent":
    "Inspect this project and apply the following security fix using the project's existing framework and conventions:",
};
