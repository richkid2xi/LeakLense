import { isTruncatedOrTimeout } from '@leaklens/security'
import type { Finding } from '@leaklens/shared'
import type { CheckRunResult, Detector, DetectorContext } from '../types'

export const ENV_PATHS = [
  '/.env',
  '/.env.production',
  '/.env.local',
]

/**
 * Checks whether response content is an HTML page (such as an SPA fallback).
 */
export function looksLikeHtml(body: string, headers?: Headers): boolean {
  if (!body) return false
  const contentType = headers?.get('content-type') || ''
  if (contentType.toLowerCase().includes('text/html')) return true
  const trimmed = body.trimStart().toLowerCase()
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<?xml') ||
    /<html\b/i.test(body) ||
    /<head\b/i.test(body) ||
    /<body\b/i.test(body)
  )
}

/**
 * Extracts environment variable names from raw .env text without storing or returning any values.
 * Variable NAMES only. Never store, log, or return file contents or secret values.
 */
export function extractEnvVariableNames(body: string): string[] {
  const names = new Set<string>()
  const regex = /(?:^|\n)\s*([A-Z][A-Z0-9_]{1,})\s*=/gm
  for (const match of body.matchAll(regex)) {
    if (match[1]) {
      names.add(match[1])
    }
  }
  return [...names].slice(0, 50)
}

/**
 * Classifies an .env probe response. Rejects SPA index pages and non-env content.
 */
export function classifyEnvFile(
  path: string,
  status: number,
  body: string,
  headers?: Headers,
): Finding | null {
  if (status !== 200 || !body.trim()) return null
  if (looksLikeHtml(body, headers)) return null

  // Strict structure validation: must have VAR_NAME= structure
  const looksLikeEnv = /(?:^|\n)\s*[A-Z][A-Z0-9_]{1,}\s*=/m.test(body)
  if (!looksLikeEnv) return null

  const variableNames = extractEnvVariableNames(body)

  return {
    id: `finding-env-${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    type: 'LL-FILE-ENV',
    ruleVersion: '1.0.0',
    severity: 'critical',
    confidence: 'confirmed',
    status: 'open',
    location: path,
    title: 'Environment configuration file (.env) is publicly reachable',
    meaning: `The server returned a publicly accessible environment file at ${path}.`,
    why: 'Environment files typically contain database connection strings, secret API keys, encryption secrets, and internal endpoints. Public exposure allows full compromise.',
    maskedEvidence: {
      location: path,
      summary: `Environment file is publicly reachable. Detected variable names: ${variableNames.join(', ') || 'none'}`,
      kind: 'file',
    },
    technicalSteps: [
      'Block access to .env files in your web server (Nginx, Apache, Caddy) or hosting platform headers.',
      'Remove .env files from the web root and static deployment bundles.',
      'Rotate all credentials and tokens listed in the environment file immediately.',
      'Purge cached responses from your CDN.',
    ],
    steps: [
      'Block access to .env files in your web server (Nginx, Apache, Caddy) or hosting platform headers.',
      'Remove .env files from the web root and static deployment bundles.',
      'Rotate all credentials and tokens listed in the environment file immediately.',
      'Purge cached responses from your CDN.',
    ],
    verificationSteps: [
      `Request ${path} in a terminal (curl -I) and verify the response is 404 Not Found or 403 Forbidden.`,
      'Run a new LeakLens scan to confirm the file is no longer reachable.',
    ],
    references: [
      {
        title: 'OWASP: Sensitive Data Exposure and File Inclusion',
        url: 'https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure',
      },
    ],
    metadata: {
      reachable: true,
      variableNames,
    },
  }
}

export const envDetector: Detector = {
  id: 'LL-CHECK-ENV',
  title: 'Publicly reachable .env files',
  category: 'Configuration',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const findings: Finding[] = []
    let truncationReason: string | undefined

    for (const path of ENV_PATHS) {
      const url = new URL(path, context.target).toString()
      try {
        const response = await context.fetchText(url)
        const finding = classifyEnvFile(path, response.status, response.body, response.headers)
        if (finding) {
          findings.push(finding)
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
        checkId: envDetector.id,
        title: envDetector.title,
        status: 'issue_found',
        findings,
      }
    }

    // Never Passed after an unproven probe
    if (truncationReason) {
      return {
        checkId: envDetector.id,
        title: envDetector.title,
        status: 'could_not_test',
        reason: `Could not complete .env file checks: ${truncationReason}`,
        findings: [],
      }
    }

    return {
      checkId: envDetector.id,
      title: envDetector.title,
      status: 'passed',
      reason: 'No publicly reachable .env files found',
      findings: [],
    }
  },
}
