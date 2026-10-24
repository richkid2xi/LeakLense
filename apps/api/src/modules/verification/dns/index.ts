import { resolveTxt } from 'node:dns/promises'
import { matchesVerificationValue } from '../token'

export interface VerificationCheckResult {
  verified: boolean
  checkedAt: string
  reason?: string
}

export type DnsResolver = (hostname: string) => Promise<string[][]>

/**
 * Verifies domain ownership via DNS TXT record at `_leaklens.<hostname>`.
 *
 * @param hostname The target hostname to verify.
 * @param expectedHash The SHA-256 hash of the verification challenge value.
 * @param customResolver Optional dependency injection for unit testing without live network.
 */
export async function verifyDnsOwnership(
  hostname: string,
  expectedHash: string,
  customResolver?: DnsResolver,
): Promise<VerificationCheckResult> {
  const checkedAt = new Date().toISOString()
  const lookupHost = `_leaklens.${hostname}`
  const resolver = customResolver ?? resolveTxt

  try {
    const rawRecords = await resolver(lookupHost)
    // DNS TXT chunks can be split into parts; join them
    const records = rawRecords.map(parts => parts.join(''))

    const verified = records.some(record => matchesVerificationValue(record, expectedHash))

    return {
      verified,
      checkedAt,
      reason: verified
        ? undefined
        : `The expected DNS TXT value was not found at ${lookupHost}. Found ${records.length} record(s).`,
    }
  } catch (err: unknown) {
    const errorCode = (err as { code?: string })?.code
    if (errorCode === 'ENOTFOUND' || errorCode === 'ENODATA' || errorCode === 'NODATA') {
      return {
        verified: false,
        checkedAt,
        reason: `DNS TXT record was not found at ${lookupHost}. Please ensure the TXT record has propagated.`,
      }
    }

    const message = err instanceof Error ? err.message : String(err)
    return {
      verified: false,
      checkedAt,
      reason: `DNS lookup failed for ${lookupHost}: ${message}`,
    }
  }
}
