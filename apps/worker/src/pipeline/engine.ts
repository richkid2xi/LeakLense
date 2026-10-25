import {
  DEFAULT_SCAN_LIMITS,
  computeExposureScore,
  SCORE_VERSION,
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
  const discoveredSourceMaps: Array<{ sourceMapUrl: string; assetUrl: string }> = []

  for (const assetUrl of assetUrls) {
    if (bytesRead >= limits.maxTotalBytes) break
    try {
      const asset = await fetcher(assetUrl, verifiedHostname, limits)
      bytesRead += asset.bytes
      requestsMade += 1
      assetBodies.push(asset.body)

      const sourceMapUrl = discoverSourceMap(asset.body, assetUrl, verifiedHostname)
      if (sourceMapUrl) {
        discoveredSourceMaps.push({ sourceMapUrl, assetUrl })
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
    discoveredSourceMaps,
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

  // 7. Calculate exposure score using pure computeExposureScore
  const scoreResult = computeExposureScore(findings, checks)
  const exposureScore = scoreResult.score

  return {
    target: page.url,
    detectedStack,
    checks,
    findings,
    exposureScore,
    scoreVersion: SCORE_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    metrics: {
      assetsFetched: assetBodies.length,
      bytesRead,
      requestsMade,
    },
  }
}
