import { isTruncatedOrTimeout } from '@leaklens/security'
import type { Finding } from '@leaklens/shared'
import type { CheckRunResult, Detector, DetectorContext } from '../types'

/**
 * Validates whether a response is a legitimate production source map JSON file.
 * Requires JSON object with 'version', 'sources', and 'mappings'.
 */
export function isValidSourceMap(body: string): boolean {
  if (!body || typeof body !== 'string') return false
  const trimmed = body.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
  try {
    const parsed = JSON.parse(trimmed)
    return (
      parsed &&
      typeof parsed === 'object' &&
      'version' in parsed &&
      'sources' in parsed &&
      'mappings' in parsed
    )
  } catch {
    return false
  }
}

export const sourceMapsDetector: Detector = {
  id: 'LL-CHECK-SOURCEMAPS',
  title: 'Public production source maps',
  category: 'Configuration',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const findings: Finding[] = []
    let truncationReason: string | undefined

    const referencedMaps = context.discoveredSourceMaps ?? []

    // If no source map is referenced in any discovered asset
    if (referencedMaps.length === 0) {
      return {
        checkId: sourceMapsDetector.id,
        title: sourceMapsDetector.title,
        status: 'passed',
        reason: 'no source map referenced',
        findings: [],
      }
    }

    let allProbesDefiniteNegative = true

    // Probe every referenced source map URL using GET
    for (const { sourceMapUrl, assetUrl } of referencedMaps) {
      try {
        const response = await context.fetchText(sourceMapUrl, { method: 'GET' })

        // 404 or 403 or non-map content is a definite negative
        if (response.status === 404 || response.status === 403) {
          continue
        }

        if (response.status === 200 && isValidSourceMap(response.body)) {
          allProbesDefiniteNegative = false
          findings.push({
            id: `finding-sourcemap-${sourceMapUrl.replace(/[^a-zA-Z0-9]/g, '_').slice(-24)}`,
            type: 'LL-FILE-SOURCEMAP',
            ruleVersion: '1.0.0',
            severity: 'medium',
            confidence: 'confirmed',
            status: 'open',
            location: sourceMapUrl,
            title: 'Production source map is publicly reachable',
            meaning:
              'The server exposes an unminified JavaScript source map (.map) alongside production assets.',
            why: 'Source maps allow anyone to inspect the original source code, internal comments, type signatures, and development-time secrets.',
            maskedEvidence: {
              location: sourceMapUrl,
              summary: `Publicly reachable source map discovered via sourceMappingURL in ${assetUrl}`,
              kind: 'file',
            },
            technicalSteps: [
              'Disable source map generation for production builds in your bundler (Vite, Next.js, Webpack).',
              'If source maps are needed for error monitoring (e.g. Sentry), upload them privately during CI/CD and delete them from public web deployment folders.',
            ],
            steps: [
              'Disable source map generation for production builds in your bundler (Vite, Next.js, Webpack).',
              'If source maps are needed for error monitoring (e.g. Sentry), upload them privately during CI/CD and delete them from public web deployment folders.',
            ],
            verificationSteps: [
              `Verify that requesting ${sourceMapUrl} returns 404 Not Found or 403 Forbidden.`,
              'Run a new LeakLens scan.',
            ],
            references: [
              {
                title: 'OWASP: Source Code Disclosure via Source Maps',
                url: 'https://cheatsheetseries.owasp.org/cheatsheets/Source_Map_Security_Cheat_Sheet.html',
              },
            ],
            metadata: {
              assetUrl,
              sourceMapUrl,
            },
          })
        } else {
          // Status 200 but body is not valid source map JSON (e.g. HTML SPA fallback or text)
          // Definite negative
        }
      } catch (err: unknown) {
        allProbesDefiniteNegative = false
        const check = isTruncatedOrTimeout(err)
        truncationReason = check.reason || (err instanceof Error ? err.message : String(err))
      }
    }

    if (findings.length > 0) {
      return {
        checkId: sourceMapsDetector.id,
        title: sourceMapsDetector.title,
        status: 'issue_found',
        findings,
      }
    }

    // If any probe was not a definite negative (e.g. timed out, truncated, or blocked)
    if (!allProbesDefiniteNegative || truncationReason) {
      return {
        checkId: sourceMapsDetector.id,
        title: sourceMapsDetector.title,
        status: 'could_not_test',
        reason: `Could not verify source map reachability: ${truncationReason || 'probe incomplete'}`,
        findings: [],
      }
    }

    // Every probed URL was a definite negative (404, 403, or non-map content)
    return {
      checkId: sourceMapsDetector.id,
      title: sourceMapsDetector.title,
      status: 'passed',
      reason: 'A source map is referenced but is not publicly readable',
      findings: [],
    }
  },
}
