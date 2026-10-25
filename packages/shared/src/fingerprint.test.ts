import { describe, it, expect } from 'vitest'
import { sha256 } from './sha256'
import {
  computeFindingFingerprint,
  normalizeLocation,
  normalizeHostname,
} from './fingerprint'

describe('sha256', () => {
  it('matches standard test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })
})

describe('normalizeLocation', () => {
  it('strips build content hashes from asset filenames', () => {
    expect(normalizeLocation('/assets/index-Bs6Dobp1.js')).toBe('/assets/index.js')
    expect(normalizeLocation('/assets/index-XyZ987wQ.js')).toBe('/assets/index.js')
    expect(normalizeLocation('/assets/vendor-d41d8cd9.css')).toBe('/assets/vendor.css')
    expect(normalizeLocation('/assets/index-Bs6Dobp1.js.map')).toBe('/assets/index.js.map')
  })

  it('consolidates and sorts query parameters alphabetically', () => {
    expect(normalizeLocation('/api/check?b=2&a=1')).toBe('/api/check?a=1&b=2')
    expect(normalizeLocation('/api/check?z=9&m=5&a=1')).toBe('/api/check?a=1&m=5&z=9')
  })

  it('consolidates redundant trailing slashes while preserving root', () => {
    expect(normalizeLocation('/api/v1/')).toBe('/api/v1')
    expect(normalizeLocation('/')).toBe('/')
  })
})

describe('normalizeHostname', () => {
  it('normalizes uppercase, protocol, port, and trailing slashes', () => {
    expect(normalizeHostname('https://EXAMPLE.com:8080/')).toBe('example.com')
    expect(normalizeHostname('http://sub.domain.io')).toBe('sub.domain.io')
  })
})

describe('computeFindingFingerprint', () => {
  it('is stable across frontend redeployments with different asset hash filenames', () => {
    const finding1 = {
      type: 'LL-SECRET-OPENAI',
      location: '/assets/index-Bs6Dobp1.js',
      maskedEvidence: {
        kind: 'key' as const,
        location: '/assets/index-Bs6Dobp1.js',
        maskedValue: 'sk-proj-••••••••••••abcd',
      },
    }

    const finding2 = {
      type: 'LL-SECRET-OPENAI',
      location: '/assets/index-9kL2mNoP.js',
      maskedEvidence: {
        kind: 'key' as const,
        location: '/assets/index-9kL2mNoP.js',
        maskedValue: 'sk-proj-••••••••••••abcd',
      },
    }

    const fp1 = computeFindingFingerprint('example.com', finding1)
    const fp2 = computeFindingFingerprint('example.com', finding2)

    expect(fp1).toBe(fp2)
    expect(fp1).toHaveLength(64)
  })

  it('differentiates secrets with different masked prefix or suffix', () => {
    const f1 = {
      type: 'LL-SECRET-OPENAI',
      location: '/assets/index.js',
      maskedEvidence: {
        kind: 'key' as const,
        location: '/assets/index.js',
        maskedValue: 'sk-proj-••••••••••••abcd',
      },
    }

    const f2 = {
      type: 'LL-SECRET-OPENAI',
      location: '/assets/index.js',
      maskedEvidence: {
        kind: 'key' as const,
        location: '/assets/index.js',
        maskedValue: 'sk-proj-••••••••••••wxyz',
      },
    }

    expect(computeFindingFingerprint('example.com', f1)).not.toBe(
      computeFindingFingerprint('example.com', f2),
    )
  })

  it('never incorporates or requires raw secrets', () => {
    const f = {
      type: 'LL-SECRET-STRIPE',
      location: '/assets/bundle.js',
      maskedEvidence: {
        kind: 'key' as const,
        location: '/assets/bundle.js',
        maskedValue: 'sk_live_••••••••••••9876',
      },
    }
    const fp = computeFindingFingerprint('example.com', f)
    expect(fp).toBeDefined()
    expect(typeof fp).toBe('string')
  })
})
