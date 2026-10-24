import {
  BuilderTarget,
  PromptPlaceholders,
  PromptPlaceholdersSchema,
  SafeTableNameRegex,
  SafeIdentifierRegex,
} from "@leaklens/shared";
import { KbEntry } from "./schema";

export interface GeneratePromptOptions {
  entry: KbEntry;
  builder: BuilderTarget;
  placeholders: PromptPlaceholders;
}

/**
 * Safely generate an AI builder fix prompt using validated placeholders.
 * Enforces strict typing and regex sanitization to eliminate prompt injection risks.
 */
export function generateFixPrompt(options: GeneratePromptOptions): string {
  const { entry, builder, placeholders } = options;

  // Validate placeholders strictly against schema
  const validated = PromptPlaceholdersSchema.parse(placeholders);

  const builderKey = (
    builder === "Any agent" ? "any_agent" : builder.toLowerCase()
  ) as keyof KbEntry["fixPromptTemplates"];

  let template = entry.fixPromptTemplates[builderKey];
  if (!template) {
    template = entry.fixPromptTemplates.any_agent;
  }

  // Safe substitution: location
  if (SafeIdentifierRegex.test(validated.location)) {
    template = template.replaceAll("{{location}}", validated.location);
  } else {
    template = template.replaceAll("{{location}}", "the affected file");
  }

  // Safe substitution: maskedKey
  if (validated.maskedKey) {
    // Only allow alphanumeric, bullet characters (•), underscores and hyphens
    const safeMaskedKey = validated.maskedKey.replace(/[^a-zA-Z0-9_•\-]/g, "");
    template = template.replaceAll("{{maskedKey}}", safeMaskedKey);
  } else {
    template = template.replaceAll("{{maskedKey}}", "••••••••");
  }

  // Safe substitution: tableName
  if (validated.tableName && SafeTableNameRegex.test(validated.tableName)) {
    template = template.replaceAll("{{tableName}}", validated.tableName);
  } else {
    template = template.replaceAll("{{tableName}}", "the target table");
  }

  // Safe substitution: bucketName
  if (validated.bucketName) {
    const safeBucket = validated.bucketName.replace(/[^a-z0-9\.\-]/g, "");
    template = template.replaceAll("{{bucketName}}", safeBucket);
  }

  return template;
}
