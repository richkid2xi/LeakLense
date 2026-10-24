import { describe, expect, it } from 'vitest'
import { ResponseTruncatedError, type SafeResponse } from '@leaklens/security'
import { isKnownPublicKey, scanBodyForSecrets, secretsDetector } from './index'

describe('secrets detector', () => {
  it('masks matching secret and never returns raw value (ported from donor)', () => {
    const raw = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456'
    const findings = scanBodyForSecrets(`const key = "${raw}"`, '/assets/app.js')
    expect(findings.length).toBe(1)
    const finding = findings[0]!
    expect(finding.type).toBe('LL-SECRET-OPENAI')
    expect(finding.maskedEvidence.maskedValue).not.toContain(raw)
    expect(JSON.stringify(finding)).not.toContain(raw)
  })

  it('does not report unrelated public configuration (ported from donor)', () => {
    expect(
      scanBodyForSecrets('const url = "https://project.supabase.co"', '/assets/app.js'),
    ).toEqual([])
  })

  it('ignores intentionally public keys (Amendment d)', () => {
    // 1. Stripe publishable keys
    const stripePkLive = 'pk_live_51Abcdefghijklmnopqrstuvwx12345'
    const stripePkTest = 'pk_test_51Abcdefghijklmnopqrstuvwx67890'
    expect(isKnownPublicKey(stripePkLive)).toBe(true)
    expect(isKnownPublicKey(stripePkTest)).toBe(true)
    expect(scanBodyForSecrets(`const stripeKey = "${stripePkLive}";`, '/assets/app.js')).toEqual(
      [],
    )
    expect(scanBodyForSecrets(`const stripeKey = "${stripePkTest}";`, '/assets/app.js')).toEqual(
      [],
    )

    // 2. Firebase web API key
    const firebaseWebKey = 'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'
    expect(isKnownPublicKey(firebaseWebKey)).toBe(true)
    expect(
      scanBodyForSecrets(`const firebaseKey = "${firebaseWebKey}";`, '/assets/app.js'),
    ).toEqual([])

    // 3. Supabase anon public key JWT
    const supabaseAnonPayload = Buffer.from(
      JSON.stringify({ role: 'anon', iss: 'supabase' }),
    ).toString('base64url')
    const supabaseAnonJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${supabaseAnonPayload}.signature12345`
    expect(isKnownPublicKey(supabaseAnonJwt)).toBe(true)
    expect(
      scanBodyForSecrets(`const supaAnon = "${supabaseAnonJwt}";`, '/assets/app.js'),
    ).toEqual([])
  })

  it('detects GitHub, AWS, and private keys correctly', () => {
    const githubPat = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
    const awsKey = 'AKIAIOSFODNN7EXAMPLE'
    const privateKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...'

    expect(scanBodyForSecrets(`const g = "${githubPat}"`, '/app.js')[0]?.type).toBe(
      'LL-SECRET-GITHUB',
    )
    expect(scanBodyForSecrets(`const a = "${awsKey}"`, '/app.js')[0]?.type).toBe(
      'LL-SECRET-AWS',
    )
    expect(scanBodyForSecrets(`const p = "${privateKey}"`, '/app.js')[0]?.type).toBe(
      'LL-SECRET-PRIVATE-KEY',
    )
  })

  it('reports could_not_test on response truncation, never passed (Amendment b)', async () => {
    const mockContext = {
      target: 'https://example.com',
      verifiedHostname: 'example.com',
      discoveredAssets: ['https://example.com/huge-bundle.js'],
      detectedTechnologies: [],
      fetchText: async (): Promise<SafeResponse> => {
        throw new ResponseTruncatedError('Response exceeded 2MB limit', 2000001, 2000000)
      },
    }

    const result = await secretsDetector.run(mockContext)
    expect(result.status).toBe('could_not_test')
    expect(result.status).not.toBe('passed')
    expect(result.reason).toContain('exceeded configured size limit')
  })
})
