import type { Finding } from '@leaklens/shared'
import { classifyEnvFile, envDetector } from './env'
import { validateGitResponse } from './git'

export * from './env'
export * from './git'
export * from './sourceMaps'

export const SENSITIVE_PATHS = [
  '/.env',
  '/.env.production',
  '/.git/HEAD',
  '/.git/config',
]

/**
 * Backwards-compatible classifySensitiveFile helper.
 */
export function classifySensitiveFile(
  path: string,
  status: number,
  body: string,
): Finding | null {
  if (path.includes('.env')) {
    return classifyEnvFile(path, status, body)
  }
  if (path.includes('.git')) {
    if (!validateGitResponse(path, status, body)) return null
    return {
      id: `finding-git-${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      type: 'LL-FILE-GIT',
      ruleVersion: '1.0.0',
      severity: 'high',
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
  return null
}

/**
 * Legacy sensitiveFilesDetector, kept for backwards compatibility.
 */
export const sensitiveFilesDetector = envDetector
