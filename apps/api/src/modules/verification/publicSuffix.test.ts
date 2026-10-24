import { describe, expect, it } from 'vitest'
import { isPlatformRootDomain, validateHostnameForVerification } from './publicSuffix'

describe('public suffix and platform root validation', () => {
  it('rejects platform root domains (Amendment e)', () => {
    const rejectedRoots = [
      'vercel.app',
      'netlify.app',
      'github.io',
      'lovable.app',
      'pages.dev',
      'firebaseapp.com',
      'web.app',
      'railway.app',
      'fly.dev',
      'onrender.com',
      'supabase.co',
    ]

    for (const root of rejectedRoots) {
      const result = validateHostnameForVerification(root)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.reason).toMatch(/Cannot verify|public suffix|platform root/)
      }
      expect(isPlatformRootDomain(root)).toBe(true)
    }
  })

  it('rejects bare top-level domains and public suffixes', () => {
    const tlds = ['com', 'co.uk', 'org', 'net', 'io']
    for (const tld of tlds) {
      const result = validateHostnameForVerification(tld)
      expect(result.valid).toBe(false)
    }
  })

  it('rejects IP addresses and localhost', () => {
    const ips = ['127.0.0.1', '10.0.0.1', '8.8.8.8', '::1', 'localhost']
    for (const ip of ips) {
      const result = validateHostnameForVerification(ip)
      expect(result.valid).toBe(false)
    }
  })

  it('accepts specific subdomains on platforms (hostname-level verification)', () => {
    const validPlatformSubdomains = [
      'my-app.vercel.app',
      'cool-project.lovable.app',
      'portfolio.netlify.app',
      'username.github.io',
      'preview.pages.dev',
      'api-service.up.railway.app',
    ]

    for (const sub of validPlatformSubdomains) {
      const result = validateHostnameForVerification(sub)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.hostname).toBe(sub)
      }
      expect(isPlatformRootDomain(sub)).toBe(false)
    }
  })

  it('accepts apex and custom domains', () => {
    const validCustomDomains = [
      'example.com',
      'sub.example.com',
      'company.co.uk',
      'staging.sub.company.org',
    ]

    for (const domain of validCustomDomains) {
      const result = validateHostnameForVerification(domain)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.hostname).toBe(domain)
      }
    }
  })

  it('cleans protocols, paths, ports, and whitespace properly', () => {
    expect(validateHostnameForVerification('https://my-app.vercel.app/')).toEqual({
      valid: true,
      hostname: 'my-app.vercel.app',
    })
    expect(validateHostnameForVerification('  http://example.com:8080/some/path  ')).toEqual({
      valid: true,
      hostname: 'example.com',
    })
  })
})
