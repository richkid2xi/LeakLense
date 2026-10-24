import { DEFAULT_SCAN_LIMITS } from '@leaklens/shared'
import { safeFetchText, type SafeResponse } from '@leaklens/security'
import { matchesVerificationValue } from '../token'
import type { VerificationCheckResult } from '../dns'

export type SafeTextFetcher = (
  url: string,
  verifiedHostname: string,
  limits?: typeof DEFAULT_SCAN_LIMITS,
) => Promise<SafeResponse>

export const WELL_KNOWN_PATH = '/.well-known/leaklens.txt'
export const MAX_FILE_BYTES = 8192

/**
 * Verifies domain ownership by fetching `/.well-known/leaklens.txt`.
 *
 * Uses safeFetchText to ensure SSRF protection, DNS-to-connection IP pinning,
 * and strict byte/timeout caps.
 */
export async function verifyFileOwnership(
  hostname: string,
  expectedHash: string,
  customFetcher?: SafeTextFetcher,
): Promise<VerificationCheckResult> {
  const checkedAt = new Date().toISOString()
  const targetUrl = `https://${hostname}${WELL_KNOWN_PATH}`
  const fetcher = customFetcher ?? safeFetchText

  try {
    const response = await fetcher(targetUrl, hostname, {
      ...DEFAULT_SCAN_LIMITS,
      maxResponseBytes: MAX_FILE_BYTES,
    })

    if (response.status !== 200) {
      return {
        verified: false,
        checkedAt,
        reason: `File at ${WELL_KNOWN_PATH} returned HTTP status ${response.status}. Expected 200 OK.`,
      }
    }

    if (response.isTruncated) {
      return {
        verified: false,
        checkedAt,
        reason: `File at ${WELL_KNOWN_PATH} exceeded maximum allowed size of ${MAX_FILE_BYTES} bytes.`,
      }
    }

    const verified = matchesVerificationValue(response.body.trim(), expectedHash)

    return {
      verified,
      checkedAt,
      reason: verified
        ? undefined
        : `File at ${WELL_KNOWN_PATH} did not contain the expected verification token.`,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      verified: false,
      checkedAt,
      reason: `Failed to fetch verification file at ${WELL_KNOWN_PATH}: ${message}`,
    }
  }
}
