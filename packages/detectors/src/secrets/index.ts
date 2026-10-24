import { createHash } from 'node:crypto'
import { isTruncatedOrTimeout, maskSecret } from '@leaklens/security'
import type { Finding, FindingSeverity } from '@leaklens/shared'
import type { CheckRunResult, Detector, DetectorContext } from '../types'

export interface SecretRule {
  id: string
  label: string
  pattern: RegExp
  severity: FindingSeverity
  ignored?: (value: string) => boolean
}

/**
 * Checks if a candidate token is an intentionally public key that should never be flagged.
 * (Amendment d: Stripe pk_, Supabase anon keys, Firebase web API keys)
 */
export function isKnownPublicKey(value: string): boolean {
  // Stripe publishable key
  if (/^pk_(?:live|test)_[A-Za-z0-9]{16,}/i.test(value)) return true
  // Firebase web API key
  if (/^AIzaSy[A-Za-z0-9_-]{33}$/.test(value)) return true
  // Supabase anon public key (JWT)
  if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    try {
      const parts = value.split('.')
      if (parts[1]) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
        if (payload?.role === 'anon' || payload?.iss === 'supabase') return true
      }
    } catch {
      // Fall through
    }
  }
  return false
}

export const SECRET_RULES: SecretRule[] = [
  {
    id: 'LL-SECRET-OPENAI',
    label: 'OpenAI API key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    severity: 'critical',
  },
  {
    id: 'LL-SECRET-STRIPE',
    label: 'Stripe secret key',
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    severity: 'critical',
    ignored: isKnownPublicKey,
  },
  {
    id: 'LL-SECRET-GITHUB',
    label: 'GitHub personal access token',
    pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g,
    severity: 'critical',
  },
  {
    id: 'LL-SECRET-AWS',
    label: 'AWS access key ID',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    severity: 'critical',
  },
  {
    id: 'LL-SECRET-PRIVATE-KEY',
    label: 'Private cryptographic key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
]

function createSecretFinding(
  rule: SecretRule,
  rawValue: string,
  location: string,
): Finding {
  const masked = maskSecret(rawValue)

  return {
    id: `finding-${createHash('sha256').update(`${rule.id}:${location}:${rawValue}`).digest('hex').slice(0, 16)}`,
    type: rule.id,
    ruleVersion: '1.0.0',
    severity: rule.severity,
    confidence: 'high',
    status: 'open',
    location,
    title: `${rule.label} exposed in public JavaScript`,
    meaning: 'A credential-like value is present in client-side code delivered to every visitor.',
    why: 'Anyone who downloads the public bundle can extract the value. If it holds privileged permissions, attackers can compromise your backend services, trigger billed API usage, or access private data.',
    maskedEvidence: {
      location,
      summary: `${rule.label} matched a high-confidence provider pattern.`,
      maskedValue: masked,
      kind: 'key',
    },
    technicalSteps: [
      'Revoke or rotate the exposed credential immediately in the provider dashboard.',
      'Move the replacement credential to a server-only environment variable.',
      'Route privileged operations through a backend API endpoint.',
      'Remove the credential from client code, rebuild, and redeploy.',
    ],
    steps: [
      'Revoke or rotate the exposed credential immediately in the provider dashboard.',
      'Move the replacement credential to a server-only environment variable.',
      'Route privileged operations through a backend API endpoint.',
      'Remove the credential from client code, rebuild, and redeploy.',
    ],
    verificationSteps: [
      'Confirm the old credential is fully revoked and returns 401 Unauthorized.',
      'Search the production bundle for the old credential fingerprint.',
      'Run a new LeakLens scan against the deployment.',
    ],
    references: [
      {
        title: 'OWASP: Secrets Management Cheat Sheet',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
      },
    ],
    metadata: {
      provider: rule.label,
    },
  }
}

/**
 * Scans a code or asset body for exposed secrets.
 * Ensures raw secrets are immediately masked and never returned in plain text.
 */
export function scanBodyForSecrets(body: string, location: string): Finding[] {
  const findings: Finding[] = []
  const seenFingerprints = new Set<string>()

  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0
    for (const match of body.matchAll(rule.pattern)) {
      const rawValue = match[0]
      if (isKnownPublicKey(rawValue)) continue
      if (rule.ignored?.(rawValue)) continue

      const fingerprint = createHash('sha256').update(`${rule.id}:${rawValue}`).digest('hex')
      if (!seenFingerprints.has(fingerprint)) {
        seenFingerprints.add(fingerprint)
        findings.push(createSecretFinding(rule, rawValue, location))
      }
    }
  }

  return findings
}

export const secretsDetector: Detector = {
  id: 'LL-CHECK-KEYS',
  title: 'Secret and API keys exposed in public JavaScript',
  category: 'Secrets',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const findings: Finding[] = []
    let truncationReason: string | undefined

    // 1. Scan primary HTML page if available
    if (context.html) {
      findings.push(...scanBodyForSecrets(context.html, context.target))
    }

    // 2. Fetch and scan discovered JavaScript assets (scope-locked)
    for (const assetUrl of context.discoveredAssets) {
      try {
        const response = await context.fetchText(assetUrl)
        if (response.status === 200 && response.body) {
          findings.push(...scanBodyForSecrets(response.body, assetUrl))
        }
      } catch (err: unknown) {
        const check = isTruncatedOrTimeout(err)
        if (check.isTruncated || check.isTimeout) {
          truncationReason = check.reason
        }
      }
    }

    if (findings.length > 0) {
      return {
        checkId: secretsDetector.id,
        title: secretsDetector.title,
        status: 'issue_found',
        findings,
      }
    }

    // Amendment b: On truncation or timeout, report could_not_test, NEVER passed!
    if (truncationReason) {
      return {
        checkId: secretsDetector.id,
        title: secretsDetector.title,
        status: 'could_not_test',
        reason: `Could not complete scan: ${truncationReason}`,
        findings: [],
      }
    }

    return {
      checkId: secretsDetector.id,
      title: secretsDetector.title,
      status: 'passed',
      findings: [],
    }
  },
}
