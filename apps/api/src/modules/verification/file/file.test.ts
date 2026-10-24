import { describe, expect, it } from 'vitest'
import type { SafeResponse } from '@leaklens/security'
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
        headers: { 'content-type': 'text/plain' },
        body: challenge.value,
        isTruncated: false,
        finalUrl: url,
      }
    }

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('fails when response status is not 200', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (): Promise<SafeResponse> => ({
      status: 404,
      headers: {},
      body: 'Not Found',
      isTruncated: false,
      finalUrl: 'https://example.com/.well-known/leaklens.txt',
    })

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('HTTP status 404')
  })

  it('fails when response body is truncated (exceeded size limit)', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (): Promise<SafeResponse> => ({
      status: 200,
      headers: {},
      body: challenge.value,
      isTruncated: true,
      finalUrl: 'https://example.com/.well-known/leaklens.txt',
    })

    const result = await verifyFileOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('exceeded maximum allowed size')
  })

  it('fails when token in file does not match', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (): Promise<SafeResponse> => ({
      status: 200,
      headers: {},
      body: 'leaklens-verification=different-token',
      isTruncated: false,
      finalUrl: 'https://example.com/.well-known/leaklens.txt',
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
