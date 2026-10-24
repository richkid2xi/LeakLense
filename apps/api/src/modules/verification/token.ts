import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const VERIFICATION_PREFIX = 'leaklens-verification='
export const VERIFICATION_EXPIRY_DAYS = 30
export const VERIFICATION_EXPIRY_MS = VERIFICATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000

export interface VerificationChallenge {
  token: string
  value: string
  tokenHash: string
  tokenPreview: string
  expiresAt: Date
}

/**
 * Creates a cryptographically random verification challenge.
 *
 * - Token is 32 base64url random bytes prefixed with 'll_'.
 * - Value is 'leaklens-verification=ll_...'.
 * - TokenHash is SHA-256 of the value.
 * - TokenPreview masks all but the first 7 and last 4 characters.
 * - Expiry is 30 days per policy.
 */
export function createVerificationChallenge(expiresInMs: number = VERIFICATION_EXPIRY_MS): VerificationChallenge {
  const token = `ll_${randomBytes(32).toString('base64url')}`
  const value = `${VERIFICATION_PREFIX}${token}`
  return {
    token,
    value,
    tokenHash: hashVerificationValue(value),
    tokenPreview: `${token.slice(0, 7)}••••${token.slice(-4)}`,
    expiresAt: new Date(Date.now() + expiresInMs),
  }
}

/**
 * SHA-256 hashes a verification value or token.
 */
export function hashVerificationValue(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex')
}

/**
 * Compares an observed value against the expected SHA-256 hash in constant time
 * using crypto.timingSafeEqual.
 *
 * Supports both raw token and prefixed value (e.g., 'll_...' or 'leaklens-verification=ll_...').
 */
export function matchesVerificationValue(value: string, expectedHash: string): boolean {
  if (!value || !expectedHash) return false

  const trimmed = value.trim()

  // Match full value (leaklens-verification=ll_...)
  const hashWithPrefix = hashVerificationValue(
    trimmed.startsWith(VERIFICATION_PREFIX) ? trimmed : `${VERIFICATION_PREFIX}${trimmed}`,
  )

  const actualBuf = Buffer.from(hashWithPrefix)
  const expectedBuf = Buffer.from(expectedHash)

  if (actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf)) {
    return true
  }

  // Fallback: match without prefix just in case expectedHash was created from raw token
  const hashRaw = hashVerificationValue(
    trimmed.startsWith(VERIFICATION_PREFIX) ? trimmed.slice(VERIFICATION_PREFIX.length) : trimmed,
  )
  const actualRawBuf = Buffer.from(hashRaw)
  if (actualRawBuf.length === expectedBuf.length && timingSafeEqual(actualRawBuf, expectedBuf)) {
    return true
  }

  return false
}

/**
 * Checks if a verification has expired (exceeds 30 days).
 */
export function isVerificationExpired(expiresAt: Date | string | number): boolean {
  const expiryTime = new Date(expiresAt).getTime()
  return Date.now() > expiryTime
}
