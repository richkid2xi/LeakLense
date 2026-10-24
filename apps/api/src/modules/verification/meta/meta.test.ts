import { describe, expect, it } from 'vitest'
import type { SafeResponse } from '@leaklens/security'
import { createVerificationChallenge } from '../token'
import { extractMetaVerificationContent, verifyMetaOwnership } from './index'

describe('extractMetaVerificationContent', () => {
  it('extracts content from standard meta tag', () => {
    const html = '<html><head><meta name="leaklens-verification" content="ll_abc123" /></head></html>'
    expect(extractMetaVerificationContent(html)).toBe('ll_abc123')
  })

  it('extracts content when content attribute precedes name attribute', () => {
    const html = '<html><head><meta content="ll_abc123" name="leaklens-verification"></head></html>'
    expect(extractMetaVerificationContent(html)).toBe('ll_abc123')
  })

  it('handles single quotes and whitespace', () => {
    const html = "<html><head><meta name='leaklens-verification' content='  ll_xyz789  '></head></html>"
    expect(extractMetaVerificationContent(html)).toBe('ll_xyz789')
  })

  it('returns null when tag is absent', () => {
    const html = '<html><head><title>Test</title></head></html>'
    expect(extractMetaVerificationContent(html)).toBeNull()
  })
})

describe('verifyMetaOwnership', () => {
  it('verifies when home page HTML contains the matching meta tag', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (url: string, host: string): Promise<SafeResponse> => {
      expect(url).toBe('https://example.com/')
      expect(host).toBe('example.com')
      const body = `<!DOCTYPE html><html><head><meta name="leaklens-verification" content="${challenge.token}" /></head><body></body></html>`
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        body,
        bytes: body.length,
        url,
      }
    }

    const result = await verifyMetaOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('fails when meta tag is missing in HTML', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (url: string): Promise<SafeResponse> => {
      const body = '<html><head><title>My App</title></head><body>No meta tag here</body></html>'
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        body,
        bytes: body.length,
        url,
      }
    }

    const result = await verifyMetaOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('verification meta tag')
  })

  it('fails when meta token does not match', async () => {
    const challenge = createVerificationChallenge()
    const mockFetcher = async (url: string): Promise<SafeResponse> => {
      const body = '<html><head><meta name="leaklens-verification" content="wrong-token" /></head></html>'
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        body,
        bytes: body.length,
        url,
      }
    }

    const result = await verifyMetaOwnership('example.com', challenge.tokenHash, mockFetcher)
    expect(result.verified).toBe(false)
    expect(result.reason).toContain('token value did not match')
  })
})
