import { describe, expect, it } from 'vitest'
import { ResponseTruncatedError, type SafeResponse } from '@leaklens/security'
import { createVerificationChallenge } from '../token'
import { verifyFileOwnership } from './index'

describe('verifyFileOwnership', () => {
  it('verifies when /.well-known/leaklens.txt contains the token value', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (url: string, host: string): Promise<SafeResponse> => {
      expect(url).toBe('https://example.com/.well-known/leaklens.txt')
      expect(host).toBe('example.com')
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: challenge.value,
        bytes: challenge.value.length,
        url,
      }
    }

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('fails when response status is not 200', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (url: string): Promise<SafeResponse> => ({
      status: 404,
      headers: new Headers(),
      body: 'Not Found',
      bytes: 9,
      url,
    })

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('HTTP status 404')
  })

  it('fails when response body is truncated (exceeded size limit)', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (): Promise<SafeResponse> => {
      throw new ResponseTruncatedError('Response exceeded 8192 bytes limit', 8193, 8192)
    }

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('exceeded maximum allowed size')
  })

  it('fails when token in file does not match', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (url: string): Promise<SafeResponse> => ({
      status: 200,
      headers: new Headers(),
      body: 'leaklens-verification=different-token',
      bytes: 37,
      url,
    })

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('did not contain the expected verification token')
  })

  it('handles network fetch errors gracefully', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (): Promise<SafeResponse> => {
      throw new Error('Connection refused')
    }

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('Failed to fetch verification file')
  })
})
