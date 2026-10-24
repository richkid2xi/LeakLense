import { describe, expect, it } from 'vitest'
import { createVerificationChallenge } from '../token'
import { verifyDnsOwnership } from './index'

describe('verifyDnsOwnership', () => {
  it('verifies when DNS TXT record contains the expected challenge value', async () => {
    const challenge = createVerificationChallenge()
    const mockResolver = async (host: string) => {
      expect(host).toBe('_leaklens.example.com')
      return [[challenge.value]]
    }

    const result = await verifyDnsOwnership('example.com', challenge.tokenHash, mockResolver)
    expect(result.verified).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('handles multi-chunk TXT records correctly', async () => {
    const challenge = createVerificationChallenge()
    const part1 = challenge.value.slice(0, 20)
    const part2 = challenge.value.slice(20)

    const mockResolver = async () => [[part1, part2]]

    const result = await verifyDnsOwnership('example.com', challenge.tokenHash, mockResolver)
    expect(result.verified).toBe(true)
  })

  it('fails with reason when TXT records exist but value does not match', async () => {
    const challenge = createVerificationChallenge()
    const mockResolver = async () => [['v=spf1 include:_spf.google.com ~all']]

    const result = await verifyDnsOwnership('example.com', challenge.tokenHash, mockResolver)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('The expected DNS TXT value was not found')
  })

  it('handles ENODATA / ENOTFOUND gracefully', async () => {
    const challenge = createVerificationChallenge()
    const mockResolver = async () => {
      const err = new Error('queryTxt ENODATA _leaklens.example.com')
      ;(err as unknown as { code: string }).code = 'ENODATA'
      throw err
    }

    const result = await verifyDnsOwnership('example.com', challenge.tokenHash, mockResolver)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('DNS TXT record was not found')
  })
})
