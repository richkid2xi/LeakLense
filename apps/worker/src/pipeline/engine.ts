import {
  DEFAULT_SCAN_LIMITS,
  type CheckResult,
  type Finding,
  type ScanEngineResult,
  type ScanLimits,
} from '@leaklens/shared'
import {
  isTruncatedOrTimeout,
  safeFetchText,
  type SafeResponse,
} from '@leaklens/security'
import {
  ALL_DETECTORS,
  detectTechnologies,
  discoverPublicAssets,
  discoverSourceMap,
  type DetectorContext,
} from '@leaklens/detectors'

export type FetchFunction = (
  url: string,
  verifiedHostname: string,
  limits: ScanLimits,
  init?: RequestInit,
) => Promise<SafeResponse>

export interface RunScanOptions {
  customLimits?: Partial<ScanLimits>
  customFetcher?: FetchFunction
}

/**
 * Orchestrates a complete security scan against a verified target website.
 *
 * Flow:
 * 1. Scope lock: targets strictly verifiedHostname.
 * 2. Fetches root HTML using SSRF-hardened, pinned-IP HTTP client.
 * 3. Discovers scripts, preloads, and source maps referenced in the page.
 * 4. Passively detects frontend and backend frameworks and providers.
 * 5. Runs all modular detectors (secrets, CORS, sensitive files, honest Phase 1 stubs).
 * 6. Calculates exposure score and aggregates metrics.
 */
export async function runScan(
  target: string,
  verifiedHostname: string,
  options: RunScanOptions = {},
): Promise<ScanEngineResult> {
  const limits: ScanLimits = { ...DEFAULT_SCAN_LIMITS, ...options.customLimits }
  const fetcher: FetchFunction = options.customFetcher ?? safeFetchText
  const startedAt = new Date().toISOString()

  let bytesRead = 0
  let requestsMade = 0
  const findings: Finding[] = []
  const checks: CheckResult[] = []

  // 1. Fetch primary target page
  const page = await fetcher(target, verifiedHostname, limits)
  bytesRead += page.bytes
  requestsMade += 1

  // 2. Discover JavaScript assets scope-locked to verifiedHostname
  const assetUrls = discoverPublicAssets(page.body, page.url, verifiedHostname).slice(
    0,
    limits.maxAssets,
  )
  const assetBodies: string[] = []
  let sourceMapFound = false

  for (const assetUrl of assetUrls) {
    if (bytesRead >= limits.maxTotalBytes) break
    try {
      const asset = await fetcher(assetUrl, verifiedHostname, limits)
      bytesRead += asset.bytes
      requestsMade += 1
      assetBodies.push(asset.body)

      const sourceMapUrl = discoverSourceMap(asset.body, assetUrl, verifiedHostname)
      if (sourceMapUrl) {
        try {
          const mapResponse = await fetcher(sourceMapUrl, verifiedHostname, {
            ...limits,
            maxResponseBytes: 200_000,
          })
          requestsMade += 1
          bytesRead += mapResponse.bytes
          if (mapResponse.status === 200 && mapResponse.body.trim().length > 0) {
            sourceMapFound = true
            findings.push({
              id: `finding-sourcemap-${assetUrl.slice(-12)}`,
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
                `Verify that requesting ${sourceMapUrl} returns 404 Not Found.`,
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
          }
        } catch {
          // Failure to fetch a source map is non-fatal
        }
      }
    } catch {
      // Individual asset fetch failure does not abort scan
    }
  }

  // 3. Passive technology stack identification
  const detectedStack = detectTechnologies(page.body, assetBodies, page.headers)

  // 4. Perform CORS preflight check
  let corsHeaders: Headers | undefined
  try {
    const cors = await fetcher(
      page.url,
      verifiedHostname,
      { ...limits, maxResponseBytes: 32_000 },
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://untrusted.invalid',
          'access-control-request-method': 'GET',
        },
      },
    )
    requestsMade += 1
    bytesRead += cors.bytes
    corsHeaders = cors.headers
  } catch {
    // CORS preflight error handled gracefully
  }

  // 5. Construct DetectorContext
  const context: DetectorContext = {
    target: page.url,
    verifiedHostname,
    fetchText: async (url, init) => {
      requestsMade += 1
      const res = await fetcher(url, verifiedHostname, limits, init)
      bytesRead += res.bytes
      return res
    },
    detectedTechnologies: detectedStack,
    discoveredAssets: assetUrls,
    html: page.body,
    responseHeaders: corsHeaders ?? page.headers,
  }

  // 6. Run all registered detectors
  for (const detector of ALL_DETECTORS) {
    if (detector.appliesTo && !detector.appliesTo(context)) {
      checks.push({
        id: detector.id,
        checkId: detector.id,
        label: detector.title,
        title: detector.title,
        status: 'not_applicable',
        reason: 'Detector criteria not met for this target',
      })
      continue
    }

    try {
      const result = await detector.run(context)
      checks.push({
        id: result.checkId,
        checkId: result.checkId,
        label: result.title,
        title: result.title,
        status: result.status,
        reason: result.reason,
      })
      findings.push(...result.findings)
    } catch (err: unknown) {
      const check = isTruncatedOrTimeout(err)
      checks.push({
        id: detector.id,
        checkId: detector.id,
        label: detector.title,
        title: detector.title,
        status: 'could_not_test',
        reason: check.reason,
      })
    }
  }

  // Record source maps check result
  checks.push({
    id: 'public-source-maps',
    checkId: 'public-source-maps',
    label: 'Public production source maps',
    title: 'Public production source maps',
    status: sourceMapFound ? 'issue_found' : 'passed',
  })

  // 7. Calculate exposure score
  const severityPenalties: Record<string, number> = {
    critical: 25,
    high: 15,
    medium: 10,
    low: 5,
  }

  const penalty = findings.reduce(
    (total, finding) => total + (severityPenalties[finding.severity] ?? 5),
    0,
  )
  const exposureScore = Math.max(0, 100 - penalty)

  return {
    target: page.url,
    detectedStack,
    checks,
    findings,
    exposureScore,
    startedAt,
    completedAt: new Date().toISOString(),
    metrics: {
      assetsFetched: assetBodies.length,
      bytesRead,
      requestsMade,
    },
  }
}
