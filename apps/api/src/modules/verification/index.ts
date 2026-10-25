import {
  normalizeVerificationMethod,
} from '@leaklens/shared'
import { verifyDnsOwnership } from './dns'
import { verifyFileOwnership } from './file'
import { verifyMetaOwnership } from './meta'
import { validateHostnameForVerification } from './publicSuffix'
import type { VerificationCheckResult, VerificationInput } from './types'

export * from './types'
export * from './token'
export * from './publicSuffix'
export * from './service'
export { verifyDnsOwnership } from './dns'
export { verifyFileOwnership } from './file'
export { verifyMetaOwnership, extractMetaVerificationContent } from './meta'

/**
 * Coordinates domain ownership verification across all supported methods:
 * - 'dns_txt': checks DNS TXT record at _leaklens.<hostname>
 * - 'file': checks /.well-known/leaklens.txt
 * - 'meta_tag': checks <meta name="leaklens-verification" ...> in home page HTML
 *
 * Enforces Public Suffix List rejection so platform root domains cannot be verified.
 */
export async function verifyOwnership(input: VerificationInput): Promise<VerificationCheckResult> {
  const checkedAt = new Date().toISOString()

  // 1. Validate hostname structure and reject platform roots
  const validation = validateHostnameForVerification(input.hostname)
  if (!validation.valid) {
    return {
      verified: false,
      checkedAt,
      reason: validation.reason,
    }
  }

  const hostname = validation.hostname
  const method = normalizeVerificationMethod(input.method)

  switch (method) {
    case 'dns_txt':
      return verifyDnsOwnership(hostname, input.expectedHash)
    case 'file':
      return verifyFileOwnership(hostname, input.expectedHash)
    case 'meta_tag':
      return verifyMetaOwnership(hostname, input.expectedHash)
    default: {
      const exhaustiveCheck: never = method
      return {
        verified: false,
        checkedAt,
        reason: `Unsupported verification method: ${exhaustiveCheck}`,
      }
    }
  }
}

/**
 * Checks all supported verification methods in order (DNS TXT, HTML meta tag, and file).
 * If any method succeeds, the domain is confirmed verified.
 */
export async function verifyOwnershipAny(
  hostname: string,
  expectedHash: string,
): Promise<VerificationCheckResult> {
  const checkedAt = new Date().toISOString()
  const validation = validateHostnameForVerification(hostname)
  if (!validation.valid) {
    return {
      verified: false,
      checkedAt,
      reason: validation.reason,
    }
  }

  const validHost = validation.hostname

  // Run DNS, Meta Tag, and Verification File checks concurrently
  const [dnsRes, metaRes, fileRes] = await Promise.allSettled([
    verifyDnsOwnership(validHost, expectedHash),
    verifyMetaOwnership(validHost, expectedHash),
    verifyFileOwnership(validHost, expectedHash),
  ])

  if (dnsRes.status === 'fulfilled' && dnsRes.value?.verified) {
    return dnsRes.value
  }
  if (metaRes.status === 'fulfilled' && metaRes.value?.verified) {
    return metaRes.value
  }
  if (fileRes.status === 'fulfilled' && fileRes.value?.verified) {
    return fileRes.value
  }

  return {
    verified: false,
    checkedAt,
    reason: 'No verification record found via DNS TXT, HTML meta tag, or /.well-known/leaklens.txt',
  }
}
