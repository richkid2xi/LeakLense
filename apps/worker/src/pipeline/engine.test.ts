import { describe, expect, it } from 'vitest'
import { runScan, type FetchFunction } from './engine'

describe('scan pipeline engine', () => {
  it('runs scan, detects technologies, finds secrets, and calculates exposure score', async () => {
    const mockFetcher: FetchFunction = async (url: string) => {
      if (url === 'https://example.com') {
        const body = `
          <!DOCTYPE html>
          <html>
            <head>
              <script src="/assets/app.js"></script>
              <link rel="preload" href="/assets/vendor.js" as="script">
            </head>
            <body>
              <div id="root">https://test.supabase.co</div>
            </body>
          </html>
        `
        return {
          status: 200,
          headers: new Headers({ 'x-vercel-id': 'iad1::123' }),
          body,
          bytes: body.length,
          url,
        }
      }

      if (url === 'https://example.com/assets/app.js') {
        const body = `
          const openaiKey = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
          //` + `# sourceMappingURL=app.js.map
        `
        return {
          status: 200,
          headers: new Headers({ 'content-type': 'application/javascript' }),
          body,
          bytes: body.length,
          url,
        }
      }

      if (url === 'https://example.com/assets/app.js.map') {
        const body = '{"version":3,"file":"app.js","sources":["app.ts"]}'
        return {
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          body,
          bytes: body.length,
          url,
        }
      }

      if (url.includes('.env') || url.includes('.git')) {
        return {
          status: 404,
          headers: new Headers(),
          body: 'Not found',
          bytes: 9,
          url,
        }
      }

      return {
        status: 200,
        headers: new Headers(),
        body: 'console.log("vendor");',
        bytes: 23,
        url,
      }
    }

    const result = await runScan('https://example.com', 'example.com', {
      customFetcher: mockFetcher,
    })

    expect(result.target).toBe('https://example.com')
    expect(result.detectedStack).toContain('Supabase')
    expect(result.detectedStack).toContain('Vercel')

    // Expect secret finding + source map finding
    const openaiFinding = result.findings.find(f => f.type === 'LL-SECRET-OPENAI')
    expect(openaiFinding).toBeDefined()
    expect(openaiFinding?.maskedEvidence.maskedValue).toContain('••••')

    const sourcemapFinding = result.findings.find(f => f.type === 'LL-FILE-SOURCEMAP')
    expect(sourcemapFinding).toBeDefined()

    // Exposure score: base 100 - (critical 25 + medium 10) = 65
    expect(result.exposureScore).toBe(65)

    // Checks run
    expect(result.checks.length).toBeGreaterThan(0)
    expect(result.metrics.requestsMade).toBeGreaterThan(0)
  })
})
