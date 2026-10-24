import { DEFAULT_SCAN_LIMITS } from '@leaklens/shared'
import { safeFetchText } from '@leaklens/security'
import { matchesVerificationValue } from '../token'
import type { SafeTextFetcher, VerificationCheckResult } from '../types'

export type { SafeTextFetcher }

export const MAX_META_BYTES = 1_000_000 // 1MB

/**
 * Extracts the content attribute of a `<meta name="leaklens-verification" content="...">` tag.
 * Handles attributes in any order, single or double quotes, and case insensitivity.
 */
export function extractMetaVerificationContent(html: string): string | null {
  if (!html) return null
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const isLeakLens = /name\s*=\s*["']leaklens-verification["']/i.test(tag)
    if (isLeakLens) {
      const match = tag.match(/content\s*=\s*["']([^"']+)["']/i)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
  }
  return null
}

/**
 * Verifies domain ownership by inspecting the HTML <meta> tags on the home page.
 *
 * Uses safeFetchText for SSRF protection and 1MB size limit.
 */
export async function verifyMetaOwnership(
  hostname: string,
  expectedHash: string,
  customFetcher?: SafeTextFetcher,
): Promise<VerificationCheckResult> {
  const checkedAt = new Date().toISOString()
  const targetUrl = `https://${hostname}/`
  const fetcher = customFetcher ?? safeFetchText

  try {
    const response = await fetcher(targetUrl, hostname, {
      ...DEFAULT_SCAN_LIMITS,
      maxResponseBytes: MAX_META_BYTES,
    })

    if (response.status < 200 || response.status >= 400) {
      return {
        verified: false,
        checkedAt,
        reason: `Home page at ${targetUrl} returned HTTP status ${response.status}.`,
      }
    }

    const content = extractMetaVerificationContent(response.body)
    if (!content) {
      return {
        verified: false,
        checkedAt,
        reason:
          'The verification meta tag `<meta name="leaklens-verification" content="..." />` was not found in the HTML.',
      }
    }

    const verified = matchesVerificationValue(content, expectedHash)

    return {
      verified,
      checkedAt,
      reason: verified
        ? undefined
        : 'The verification meta tag was found, but the token value did not match.',
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      verified: false,
      checkedAt,
      reason: `Failed to fetch home page HTML at ${targetUrl}: ${message}`,
    }
  }
}
