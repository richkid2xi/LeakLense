import { isTruncatedOrTimeout } from '@leaklens/security'
import type { Finding } from '@leaklens/shared'
import type { CheckRunResult, Detector, DetectorContext } from '../types'
import { looksLikeHtml } from './env'

export const GIT_METADATA_PATHS = [
  '/.git/HEAD',
  '/.git/config',
]

export const GIT_OBJECT_PATHS = [
  '/.git/index',
]

export interface GitProbeResult {
  path: string
  reachable: boolean
  isObject: boolean
}

/**
 * Validates whether a response matches Git internal metadata or binary index.
 */
export function validateGitResponse(path: string, status: number, body: string, headers?: Headers): boolean {
  if (status !== 200 || !body || looksLikeHtml(body, headers)) return false

  if (path.endsWith('HEAD')) {
    return /ref:\s+refs\//.test(body) || /^[0-9a-f]{40}$/m.test(body.trim())
  }
  if (path.endsWith('config')) {
    return /\[core\]/i.test(body)
  }
  if (path.endsWith('index')) {
    // Git index binary file starts with 'DIRC' (0x44 0x49 0x52 0x43)
    return body.startsWith('DIRC') || body.includes('DIRC')
  }
  return false
}

export const gitDetector: Detector = {
  id: 'LL-CHECK-GIT',
  title: 'Publicly reachable .git repository metadata',
  category: 'Configuration',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const reachablePaths: string[] = []
    let canRetrieveObjects = false
    let truncationReason: string | undefined

    // 1. Probe metadata paths (HEAD, config)
    for (const path of GIT_METADATA_PATHS) {
      const url = new URL(path, context.target).toString()
      try {
        const response = await context.fetchText(url)
        if (validateGitResponse(path, response.status, response.body, response.headers)) {
          reachablePaths.push(path)
        }
      } catch (err: unknown) {
        const check = isTruncatedOrTimeout(err)
        if (check.isTruncated || check.isTimeout) {
          truncationReason = check.reason
        }
      }
    }

    // 2. If metadata is reachable, perform one read-only probe for objects/history (/.git/index)
    if (reachablePaths.length > 0) {
      for (const path of GIT_OBJECT_PATHS) {
        const url = new URL(path, context.target).toString()
        try {
          const response = await context.fetchText(url)
          if (validateGitResponse(path, response.status, response.body, response.headers)) {
            canRetrieveObjects = true
            reachablePaths.push(path)
          }
        } catch {
          // Object probe failure is non-fatal; simply indicates objects are not retrievable
        }
      }

      // Consolidate multiple reachable .git paths into ONE finding
      const primaryLocation = reachablePaths[0] || '/.git/HEAD'
      const severity = canRetrieveObjects ? 'critical' : 'high'
      const why = canRetrieveObjects
        ? 'Publicly reachable Git repository objects and index allow attackers to fully retrieve source code files, commit history, branch changes, and past credentials.'
        : 'Publicly reachable Git metadata (HEAD/config) discloses repository configuration, remote origin URLs, and branch references, but repository objects and history could not be directly retrieved.'

      const finding: Finding = {
        id: 'finding-git-repository',
        type: 'LL-FILE-GIT',
        ruleVersion: '1.0.0',
        severity,
        confidence: 'confirmed',
        status: 'open',
        location: primaryLocation,
        title: canRetrieveObjects
          ? 'Git repository objects and metadata are publicly reachable'
          : 'Git repository metadata is publicly reachable',
        meaning: `The server exposes Git version-control data at ${reachablePaths.join(', ')}.`,
        why,
        maskedEvidence: {
          location: primaryLocation,
          summary: `Reachable Git repository paths: ${reachablePaths.join(', ')}`,
          kind: 'file',
        },
        technicalSteps: [
          'Configure your web server, CDN, or reverse proxy to block all requests starting with /.git/.',
          'Ensure deployment scripts and build processes do not copy the .git directory to the public web root.',
          'Rotate any API keys or credentials that may have ever been committed to the repository.',
        ],
        steps: [
          'Configure your web server, CDN, or reverse proxy to block all requests starting with /.git/.',
          'Ensure deployment scripts and build processes do not copy the .git directory to the public web root.',
          'Rotate any API keys or credentials that may have ever been committed to the repository.',
        ],
        verificationSteps: [
          `Verify that requesting ${primaryLocation} returns 404 Not Found or 403 Forbidden.`,
          'Run a new LeakLens scan to verify Git metadata is no longer reachable.',
        ],
        references: [
          {
            title: 'OWASP: Web Security Testing Guide - Review Web Server Metafiles',
            url: 'https://owasp.org/www-project-web-security-testing-guide/',
          },
        ],
        metadata: {
          reachable: true,
          paths: reachablePaths,
          canRetrieveObjects,
        },
      }

      return {
        checkId: gitDetector.id,
        title: gitDetector.title,
        status: 'issue_found',
        findings: [finding],
      }
    }

    // Never Passed after an unproven probe
    if (truncationReason) {
      return {
        checkId: gitDetector.id,
        title: gitDetector.title,
        status: 'could_not_test',
        reason: `Could not complete Git metadata checks: ${truncationReason}`,
        findings: [],
      }
    }

    return {
      checkId: gitDetector.id,
      title: gitDetector.title,
      status: 'passed',
      reason: 'No publicly reachable .git folders found',
      findings: [],
    }
  },
}
