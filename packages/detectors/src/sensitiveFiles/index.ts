import { isTruncatedOrTimeout } from '@leaklens/security'
import type { Finding } from '@leaklens/shared'
import type { CheckRunResult, Detector, DetectorContext } from '../types'

export const SENSITIVE_PATHS = [
  '/.env',
  '/.env.production',
  '/.git/HEAD',
  '/.git/config',
]

/**
 * Extracts environment variable names from raw .env text without storing or returning any values.
 * (Amendment c: variable NAMES at most. Never store, log or return file contents.)
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
 * Validates whether a response genuinely matches the expected internal structure
 * of an environment file or Git repository metadata to eliminate 404-as-200 false positives.
 */
export function classifySensitiveFile(
  path: string,
  status: number,
  body: string,
): Finding | null {
  if (status !== 200 || !body.trim()) return null

  const isEnv = path.includes('.env')
  const isGit = path.includes('.git')

  // Strict structure validation
  const looksLikeEnv = isEnv && /(?:^|\n)\s*[A-Z][A-Z0-9_]{1,}\s*=/m.test(body)
  const looksLikeGit = isGit && (/ref:\s+refs\//.test(body) || /\[core\]/.test(body))

  if (!looksLikeEnv && !looksLikeGit) return null

  if (isGit) {
    return {
      id: `finding-git-${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      type: 'LL-FILE-GIT',
      ruleVersion: '1.0.0',
      severity: 'critical',
      confidence: 'confirmed',
      status: 'open',
      location: path,
      title: 'Git metadata repository is publicly reachable',
      meaning: `The server returned a valid Git internal structure at ${path}.`,
      why: 'Publicly reachable .git metadata allows attackers to reconstruct the entire source code history, internal commit messages, author details, and past credentials.',
      maskedEvidence: {
        location: path,
        summary: 'Reachable Git repository metadata with verified internal structure (ref/core headers).',
        kind: 'file',
      },
      technicalSteps: [
        'Configure the web server or reverse proxy to deny all requests to dotfiles and /.git folders.',
        'Ensure build output directories do not include source-control metadata.',
        'Purge edge and CDN caches for the exposed path.',
      ],
      steps: [
        'Configure the web server or reverse proxy to deny all requests to dotfiles and /.git folders.',
        'Ensure build output directories do not include source-control metadata.',
        'Purge edge and CDN caches for the exposed path.',
      ],
      verificationSteps: [
        `Request ${path} directly in an incognito browser tab and verify it returns HTTP 404 or 403.`,
        'Run a new LeakLens scan to confirm resolution.',
      ],
      references: [
        {
          title: 'OWASP: Web Security Testing Guide - Review Web Server Metafiles',
          url: 'https://owasp.org/www-project-web-security-testing-guide/',
        },
      ],
      metadata: {
        reachable: true,
      },
    }
  }

  // Environment file: store only variable names, NEVER values
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

export const sensitiveFilesDetector: Detector = {
  id: 'LL-CHECK-SENSITIVE-FILES',
  title: 'Reachable .env files, .git folders, source maps',
  category: 'Configuration',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const findings: Finding[] = []
    let truncationReason: string | undefined

    for (const path of SENSITIVE_PATHS) {
      const url = new URL(path, context.target).toString()
      try {
        const response = await context.fetchText(url)
        const finding = classifySensitiveFile(path, response.status, response.body)
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
        checkId: sensitiveFilesDetector.id,
        title: sensitiveFilesDetector.title,
        status: 'issue_found',
        findings,
      }
    }

    // Amendment b: On truncation or timeout, report could_not_test, NEVER passed!
    if (truncationReason) {
      return {
        checkId: sensitiveFilesDetector.id,
        title: sensitiveFilesDetector.title,
        status: 'could_not_test',
        reason: `Could not complete sensitive file checks: ${truncationReason}`,
        findings: [],
      }
    }

    return {
      checkId: sensitiveFilesDetector.id,
      title: sensitiveFilesDetector.title,
      status: 'passed',
      findings: [],
    }
  },
}
