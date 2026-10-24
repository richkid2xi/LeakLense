import { describe, expect, it } from 'vitest'
import type { Finding } from '@leaklens/shared'
import { LL_KEY_001 } from './entries/LL-KEY-001'
import {
  buildAllPrompts,
  buildFixPrompt,
  generateFixPrompt,
  normalizePromptTarget,
} from './generator'

describe('prompt generator', () => {
  const mockFinding: Finding = {
    id: 'f-1',
    type: 'LL-SECRET-OPENAI',
    ruleVersion: '1.0.0',
    severity: 'critical',
    status: 'open',
    location: '/assets/index.js',
    title: 'OpenAI API key exposed in public JavaScript',
    meaning: 'A secret OpenAI credential is in client bundle',
    why: 'Attackers can steal quota',
    maskedEvidence: {
      location: '/assets/index.js',
      maskedValue: 'sk-proj-••••••••••••1234',
      kind: 'key',
    },
    technicalSteps: ['Rotate the key', 'Move to server env'],
    steps: ['Rotate the key', 'Move to server env'],
    verificationSteps: ['Check HTTP 401 on old key'],
    references: [],
    metadata: {},
  }

  it('normalizes prompt targets', () => {
    expect(normalizePromptTarget('Lovable')).toBe('lovable')
    expect(normalizePromptTarget('bolt')).toBe('bolt')
    expect(normalizePromptTarget('Cursor')).toBe('cursor')
    expect(normalizePromptTarget('v0')).toBe('v0')
    expect(normalizePromptTarget('unknown')).toBe('generic')
  })

  it('builds tailored fix prompts for all target agents', () => {
    const lovablePrompt = buildFixPrompt(mockFinding, 'Lovable')
    expect(lovablePrompt).toContain('Update this Lovable project')
    expect(lovablePrompt).toContain('Location: /assets/index.js')
    expect(lovablePrompt).toContain('1. Rotate the key')
    expect(lovablePrompt).toContain('1. Check HTTP 401 on old key')

    const cursorPrompt = buildFixPrompt(mockFinding, 'Cursor')
    expect(cursorPrompt).toContain('Inspect the relevant files in this Cursor workspace')

    const all = buildAllPrompts(mockFinding)
    expect(all.lovable).toBeDefined()
    expect(all.bolt).toBeDefined()
    expect(all.cursor).toBeDefined()
    expect(all.v0).toBeDefined()
    expect(all.generic).toBeDefined()
  })

  it('generates fix prompt from KB entry with safe placeholder substitutions', () => {
    const prompt = generateFixPrompt({
      entry: LL_KEY_001,
      builder: 'Lovable',
      placeholders: {
        findingTitle: 'Exposed Secret Key',
        location: 'src/lib/stripe.ts',
        maskedKey: 'sk_live_••••1234',
        specificSteps: ['Rotate key'],
      },
    })

    expect(prompt).toContain('src/lib/stripe.ts')
    expect(prompt).toContain('sk_live_••••1234')
  })
})
