import {
  type BuilderTarget,
  type Finding,
  type PromptPlaceholders,
  PromptPlaceholdersSchema,
  SafeTableNameRegex,
  SafeIdentifierRegex,
} from '@leaklens/shared'
import type { KbEntry } from './schema'

export type PromptTarget = 'lovable' | 'bolt' | 'cursor' | 'v0' | 'generic'

export interface GeneratePromptOptions {
  entry: KbEntry
  builder: BuilderTarget
  placeholders: PromptPlaceholders
}

const TARGET_INTRODUCTIONS: Record<PromptTarget, string> = {
  lovable: 'Update this Lovable project using the smallest scoped change required.',
  bolt: 'Update this Bolt project using the smallest scoped code and configuration changes required.',
  cursor: 'Inspect the relevant files in this Cursor workspace before making a minimal patch.',
  v0: 'Update this v0 project. Keep secrets and privileged operations out of client components.',
  generic:
    'Inspect this repository and apply the following fix using its existing framework and conventions.',
}

export function normalizePromptTarget(target: string): PromptTarget {
  const lower = target.toLowerCase()
  if (lower === 'lovable') return 'lovable'
  if (lower === 'bolt') return 'bolt'
  if (lower === 'cursor') return 'cursor'
  if (lower === 'v0') return 'v0'
  return 'generic'
}

/**
 * Builds a structured, copy-pasteable fix prompt tailored for an AI coding agent
 * (Lovable, Bolt, Cursor, v0, or generic) directly from a Finding.
 */
export function buildFixPrompt(
  finding: Finding,
  targetInput: PromptTarget | BuilderTarget | string = 'generic',
): string {
  const target = normalizePromptTarget(targetInput)
  const steps =
    finding.technicalSteps && finding.technicalSteps.length > 0
      ? finding.technicalSteps
      : finding.steps
  const verification =
    finding.verificationSteps && finding.verificationSteps.length > 0
      ? finding.verificationSteps
      : ['Run a new LeakLens scan to verify resolution.']

  return `${TARGET_INTRODUCTIONS[target]}

Finding: ${finding.title}
Location: ${finding.location}
Why it matters: ${finding.why || finding.meaning}

Required changes:
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Constraints:
- Do not print or expose any full credential or raw secret.
- Preserve unrelated UI and application behavior.
- Follow the principle of least privilege.
- Add or update focused tests where practical.
- Do not claim the issue is resolved until the verification steps pass.

Verification steps:
${verification.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Finally, list the files changed and explain any manual provider-dashboard action the user must complete.`
}

/**
 * Builds prompts for all supported AI builders simultaneously.
 */
export function buildAllPrompts(finding: Finding) {
  return {
    lovable: buildFixPrompt(finding, 'lovable'),
    bolt: buildFixPrompt(finding, 'bolt'),
    cursor: buildFixPrompt(finding, 'cursor'),
    v0: buildFixPrompt(finding, 'v0'),
    generic: buildFixPrompt(finding, 'generic'),
  }
}

/**
 * Safely generate an AI builder fix prompt using validated placeholders.
 * Enforces strict typing and regex sanitization to eliminate prompt injection risks.
 */
export function generateFixPrompt(options: GeneratePromptOptions): string {
  const { entry, builder, placeholders } = options

  // Validate placeholders strictly against schema
  const validated = PromptPlaceholdersSchema.parse(placeholders)

  const builderKey = (
    builder === 'Any agent' ? 'any_agent' : builder.toLowerCase()
  ) as keyof KbEntry['fixPromptTemplates']

  let template = entry.fixPromptTemplates[builderKey]
  if (!template) {
    template = entry.fixPromptTemplates.any_agent
  }

  // Safe substitution: location
  if (SafeIdentifierRegex.test(validated.location)) {
    template = template.replaceAll('{{location}}', validated.location)
  } else {
    template = template.replaceAll('{{location}}', 'the affected file')
  }

  // Safe substitution: maskedKey
  if (validated.maskedKey) {
    const safeMaskedKey = validated.maskedKey.replace(/[^a-zA-Z0-9_•\-]/g, '')
    template = template.replaceAll('{{maskedKey}}', safeMaskedKey)
  } else {
    template = template.replaceAll('{{maskedKey}}', '••••••••')
  }

  // Safe substitution: tableName
  if (validated.tableName && SafeTableNameRegex.test(validated.tableName)) {
    template = template.replaceAll('{{tableName}}', validated.tableName)
  } else {
    template = template.replaceAll('{{tableName}}', 'the target table')
  }

  // Safe substitution: bucketName
  if (validated.bucketName) {
    const safeBucket = validated.bucketName.replace(/[^a-z0-9\.\-]/g, '')
    template = template.replaceAll('{{bucketName}}', safeBucket)
  }

  return template
}
