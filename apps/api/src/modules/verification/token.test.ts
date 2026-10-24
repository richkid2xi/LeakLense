import { describe, expect, it } from 'vitest'
import {
  createVerificationChallenge,
  isVerificationExpired,
  matchesVerificationValue,
  VERIFICATION_EXPIRY_DAYS,
} from './token'

describe('verification token', () => {
  it('stores a one-way hash and compares values safely (ported from donor)', () => {
    const challenge = createVerificationChallenge()
    expect(challenge.tokenHash).not.toContain(challenge.token)
    expect(matchesVerificationValue(challenge.value, challenge.tokenHash)).toBe(true)
    expect(matchesVerificationValue(`${challenge.value}x`, challenge.tokenHash)).toBe(false)
  })

  it('matches raw token without prefix', () => {
    const challenge = createVerificationChallenge()
    // If user inputs or file contains just the token `ll_...` without `leaklens-verification=`
    expect(matchesVerificationValue(challenge.token, challenge.tokenHash)).toBe(true)
  })

  it('sets 30-day expiry by default', () => {
    const challenge = createVerificationChallenge()
    const diffDays = (challenge.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    expect(Math.round(diffDays)).toBe(VERIFICATION_EXPIRY_DAYS)
  })

  it('correctly detects expired and valid challenges', () => {
    const pastDate = new Date(Date.now() - 1000)
    const futureDate = new Date(Date.now() + 10000)
    expect(isVerificationExpired(pastDate)).toBe(true)
    expect(isVerificationExpired(futureDate)).toBe(false)
  })

  it('masks token preview safely', () => {
    const challenge = createVerificationChallenge()
    expect(challenge.tokenPreview).toContain('••••')
    expect(challenge.tokenPreview.startsWith(challenge.token.slice(0, 7))).toBe(true)
    expect(challenge.tokenPreview.endsWith(challenge.token.slice(-4))).toBe(true)
  })
})
