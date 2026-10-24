import { describe, expect, it } from 'vitest'
import {
  ALL_DETECTORS,
  firebaseDetector,
  storageDetector,
  supabaseAnonDetector,
  supabaseRlsDetector,
} from './registry'
import { detectTechnologies } from './technology'
import { discoverPublicAssets, discoverSourceMap } from './discovery'

describe('detector registry & coverage honesty (Amendment g)', () => {
  it('registers all 7 planned checks', () => {
    expect(ALL_DETECTORS.length).toBe(7)
  })

  it('Supabase open tables reports could_not_test if Supabase detected, not_applicable if absent', async () => {
    const contextWithSupa = {
      target: 'https://example.com',
      verifiedHostname: 'example.com',
      discoveredAssets: [],
      detectedTechnologies: ['Supabase'],
      fetchText: async () => ({ status: 200, headers: new Headers(), body: '', bytes: 0, url: '' }),
    }

    const supaResult = await supabaseAnonDetector.run(contextWithSupa)
    expect(supaResult.status).toBe('could_not_test')
    expect(supaResult.status).not.toBe('passed')
    expect(supaResult.reason).toContain('Phase 1')

    const contextWithoutSupa = { ...contextWithSupa, detectedTechnologies: [] }
    const noSupaResult = await supabaseAnonDetector.run(contextWithoutSupa)
    expect(noSupaResult.status).toBe('not_applicable')
  })

  it('Supabase RLS reports could_not_test if Supabase detected, not_applicable if absent', async () => {
    const contextWithSupa = {
      target: 'https://example.com',
      verifiedHostname: 'example.com',
      discoveredAssets: [],
      detectedTechnologies: ['Supabase'],
      fetchText: async () => ({ status: 200, headers: new Headers(), body: '', bytes: 0, url: '' }),
    }

    const rlsResult = await supabaseRlsDetector.run(contextWithSupa)
    expect(rlsResult.status).toBe('could_not_test')
    expect(rlsResult.status).not.toBe('passed')

    const contextWithoutSupa = { ...contextWithSupa, detectedTechnologies: [] }
    const noRlsResult = await supabaseRlsDetector.run(contextWithoutSupa)
    expect(noRlsResult.status).toBe('not_applicable')
  })

  it('Storage bucket detector reports could_not_test, never fake pass', async () => {
    const res = await storageDetector.run({
      target: 'https://example.com',
      verifiedHostname: 'example.com',
      discoveredAssets: [],
      detectedTechnologies: [],
      fetchText: async () => ({ status: 200, headers: new Headers(), body: '', bytes: 0, url: '' }),
    })
    expect(res.status).toBe('could_not_test')
    expect(res.status).not.toBe('passed')
  })

  it('Firebase rules detector reports could_not_test if Firebase detected, not_applicable if absent', async () => {
    const contextWithFirebase = {
      target: 'https://example.com',
      verifiedHostname: 'example.com',
      discoveredAssets: [],
      detectedTechnologies: ['Firebase'],
      fetchText: async () => ({ status: 200, headers: new Headers(), body: '', bytes: 0, url: '' }),
    }

    const fbResult = await firebaseDetector.run(contextWithFirebase)
    expect(fbResult.status).toBe('could_not_test')
    expect(fbResult.status).not.toBe('passed')

    const contextWithoutFb = { ...contextWithFirebase, detectedTechnologies: [] }
    const noFbResult = await firebaseDetector.run(contextWithoutFb)
    expect(noFbResult.status).toBe('not_applicable')
  })
})

describe('technology and asset discovery', () => {
  it('identifies technologies from HTML and headers', () => {
    const html = '<html><head><script src="/assets/index-abc.js"></script></head><body>https://abc.supabase.co</body></html>'
    const headers = new Headers({ 'x-vercel-id': 'iad1::xyz' })
    const techs = detectTechnologies(html, ['/assets/index-abc.js'], headers)
    expect(techs).toContain('Supabase')
    expect(techs).toContain('Vercel')
    expect(techs).toContain('Vite')
  })

  it('discovers scripts and source maps locked to target hostname', () => {
    const html = `
      <script src="https://example.com/app.js"></script>
      <script src="https://evil.com/malicious.js"></script>
      <link rel="preload" href="/chunk.js" as="script">
    `
    const assets = discoverPublicAssets(html, 'https://example.com/', 'example.com')
    expect(assets).toContain('https://example.com/app.js')
    expect(assets).toContain('https://example.com/chunk.js')
    expect(assets).not.toContain('https://evil.com/malicious.js')

    const sourceMap = discoverSourceMap('//# sourceMappingURL=app.js.map', 'https://example.com/app.js', 'example.com')
    expect(sourceMap).toBe('https://example.com/app.js.map')

    const thirdPartyMap = discoverSourceMap('//# sourceMappingURL=https://other.com/app.js.map', 'https://example.com/app.js', 'example.com')
    expect(thirdPartyMap).toBeNull()
  })
})
