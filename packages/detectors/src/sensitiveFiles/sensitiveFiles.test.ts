import { describe, expect, it } from 'vitest'
import { ResponseTruncatedError, RequestTimeoutError, type SafeResponse } from '@leaklens/security'
import {
  classifyEnvFile,
  extractEnvVariableNames,
  envDetector,
  gitDetector,
  sourceMapsDetector,
  isValidSourceMap,
} from './index'

describe('Scanner Hardening: Sensitive Files, Git & Source Maps (Part A)', () => {
  describe('Fixture 1: /.env returning SPA HTML index page (status 200)', () => {
    it('does NOT create a finding and the check is Passed ("no env file found")', async () => {
      const spaIndexHtml = `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Single Page App</title>
            <script src="/assets/index-Bs6Dobp1.js"></script>
          </head>
          <body>
            <div id="root">Welcome to my portfolio</div>
          </body>
        </html>
      `.trim()

      const mockContext = {
        target: 'https://elidex.vercel.app',
        verifiedHostname: 'elidex.vercel.app',
        discoveredAssets: ['https://elidex.vercel.app/assets/index-Bs6Dobp1.js'],
        detectedTechnologies: ['React', 'Vite'],
        fetchText: async (url: string): Promise<SafeResponse> => {
          return {
            status: 200,
            headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
            body: spaIndexHtml,
            bytes: spaIndexHtml.length,
            url,
          }
        },
      }

      const result = await envDetector.run(mockContext)
      expect(result.findings).toHaveLength(0)
      expect(result.status).toBe('passed')
      expect(result.reason?.toLowerCase()).toContain('no publicly reachable .env files found')
    })
  })

  describe('Fixture 2: Source map referenced but .map returns 403 or 404', () => {
    it('marks check as Passed with detail note: "A source map is referenced but is not publicly readable"', async () => {
      const mockContext403 = {
        target: 'https://elidex.vercel.app',
        verifiedHostname: 'elidex.vercel.app',
        discoveredAssets: ['https://elidex.vercel.app/assets/index-Bs6Dobp1.js'],
        discoveredSourceMaps: [
          {
            sourceMapUrl: 'https://elidex.vercel.app/assets/index-Bs6Dobp1.js.map',
            assetUrl: 'https://elidex.vercel.app/assets/index-Bs6Dobp1.js',
          },
        ],
        detectedTechnologies: ['Vite'],
        fetchText: async (url: string): Promise<SafeResponse> => {
          if (url.endsWith('.map')) {
            return {
              status: 403,
              headers: new Headers({ 'content-type': 'text/plain', 'cache-control': 'no-store' }),
              body: 'Forbidden',
              bytes: 9,
              url,
            }
          }
          return {
            status: 200,
            headers: new Headers(),
            body: 'console.log("ok");',
            bytes: 18,
            url,
          }
        },
      }

      const result403 = await sourceMapsDetector.run(mockContext403)
      expect(result403.findings).toHaveLength(0)
      expect(result403.status).toBe('passed')
      expect(result403.reason).toBe('A source map is referenced but is not publicly readable')

      // 404 case
      const mockContext404 = {
        ...mockContext403,
        fetchText: async (url: string): Promise<SafeResponse> => ({
          status: 404,
          headers: new Headers(),
          body: 'Not Found',
          bytes: 9,
          url,
        }),
      }

      const result404 = await sourceMapsDetector.run(mockContext404)
      expect(result404.findings).toHaveLength(0)
      expect(result404.status).toBe('passed')
      expect(result404.reason).toBe('A source map is referenced but is not publicly readable')
    })
  })

  describe('Source map probing rules', () => {
    it('distinguishes "no source map referenced" when no asset contains a sourceMappingURL', async () => {
      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: ['https://example.com/assets/main.js'],
        discoveredSourceMaps: [],
        detectedTechnologies: [],
        fetchText: async (url: string): Promise<SafeResponse> => ({
          status: 200,
          headers: new Headers(),
          body: 'console.log("no map");',
          bytes: 20,
          url,
        }),
      }

      const result = await sourceMapsDetector.run(mockContext)
      expect(result.status).toBe('passed')
      expect(result.reason).toBe('no source map referenced')
    })

    it('reports Issue found ONLY if response is valid JSON containing version, sources, and mappings', async () => {
      const validMapJson = JSON.stringify({
        version: 3,
        file: 'bundle.js',
        sources: ['src/index.ts', 'src/api.ts'],
        mappings: 'AAAA,SAAS,GAAG...',
        sourceRoot: '',
      })

      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: ['https://example.com/bundle.js'],
        discoveredSourceMaps: [
          {
            sourceMapUrl: 'https://example.com/bundle.js.map',
            assetUrl: 'https://example.com/bundle.js',
          },
        ],
        detectedTechnologies: [],
        fetchText: async (url: string): Promise<SafeResponse> => ({
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: validMapJson,
          bytes: validMapJson.length,
          url,
        }),
      }

      const result = await sourceMapsDetector.run(mockContext)
      expect(result.status).toBe('issue_found')
      expect(result.findings).toHaveLength(1)
      expect(result.findings[0]?.type).toBe('LL-FILE-SOURCEMAP')
      expect(result.findings[0]?.location).toBe('https://example.com/bundle.js.map')
    })

    it('does NOT report an issue if status 200 returns JSON missing version, sources, or mappings (e.g. API payload)', async () => {
      const notAMapJson = JSON.stringify({
        error: 'Not found',
        code: 404,
      })

      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: ['https://example.com/bundle.js'],
        discoveredSourceMaps: [
          {
            sourceMapUrl: 'https://example.com/bundle.js.map',
            assetUrl: 'https://example.com/bundle.js',
          },
        ],
        detectedTechnologies: [],
        fetchText: async (url: string): Promise<SafeResponse> => ({
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: notAMapJson,
          bytes: notAMapJson.length,
          url,
        }),
      }

      const result = await sourceMapsDetector.run(mockContext)
      expect(result.status).toBe('passed')
      expect(result.findings).toHaveLength(0)
      expect(isValidSourceMap(notAMapJson)).toBe(false)
    })

    it('reports could_not_test if a probe timed out, was truncated, or was blocked', async () => {
      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: ['https://example.com/bundle.js'],
        discoveredSourceMaps: [
          {
            sourceMapUrl: 'https://example.com/bundle.js.map',
            assetUrl: 'https://example.com/bundle.js',
          },
        ],
        detectedTechnologies: [],
        fetchText: async (): Promise<SafeResponse> => {
          throw new RequestTimeoutError('Connection timed out after 10000ms', 10000)
        },
      }

      const result = await sourceMapsDetector.run(mockContext)
      expect(result.status).toBe('could_not_test')
      expect(result.status).not.toBe('passed')
    })
  })

  describe('.env and .git probe discipline: never Passed after an unproven probe', () => {
    it('.env detector reports could_not_test on probe timeout, never passed', async () => {
      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: [],
        detectedTechnologies: [],
        fetchText: async (): Promise<SafeResponse> => {
          throw new RequestTimeoutError('Connection timed out', 10000)
        },
      }

      const result = await envDetector.run(mockContext)
      expect(result.status).toBe('could_not_test')
      expect(result.status).not.toBe('passed')
    })

    it('.git detector reports could_not_test on response truncation, never passed', async () => {
      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: [],
        detectedTechnologies: [],
        fetchText: async (): Promise<SafeResponse> => {
          throw new ResponseTruncatedError('Response exceeded limit', 2000001, 2000000)
        },
      }

      const result = await gitDetector.run(mockContext)
      expect(result.status).toBe('could_not_test')
      expect(result.status).not.toBe('passed')
    })
  })

  describe('.env finding: variable names only, NEVER raw secret values', () => {
    it('stores variable names and proves raw passwords/keys never appear in serialized scan result or logs', async () => {
      const liveEnvContent = `
        # Live Database Credentials
        DATABASE_URL=postgres://app_user:super_ultra_secret_pw_98765@db.production.internal:5432/main_db
        STRIPE_SECRET_KEY=sk_live_verysecretstripekey999
        SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.super_secret_jwt_signature
        AUTH_PEPPER=pepper_salt_secret_val
        PORT=8080
      `.trim()

      const names = extractEnvVariableNames(liveEnvContent)
      expect(names).toEqual([
        'DATABASE_URL',
        'STRIPE_SECRET_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'AUTH_PEPPER',
        'PORT',
      ])

      const finding = classifyEnvFile('/.env', 200, liveEnvContent)
      expect(finding).not.toBeNull()
      if (!finding) return

      expect(finding.type).toBe('LL-FILE-ENV')
      expect(finding.metadata.variableNames).toEqual(names)
      expect(finding.metadata.reachable).toBe(true)

      // Strict serialization check: raw secret values must NEVER appear in JSON
      const serialized = JSON.stringify(finding)
      expect(serialized).not.toContain('super_ultra_secret_pw_98765')
      expect(serialized).not.toContain('sk_live_verysecretstripekey999')
      expect(serialized).not.toContain('super_secret_jwt_signature')
      expect(serialized).not.toContain('pepper_salt_secret_val')
    })
  })

  describe('.git path consolidation and severity classification', () => {
    it('consolidates multiple reachable .git paths (HEAD and config) into ONE finding', async () => {
      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: [],
        detectedTechnologies: [],
        fetchText: async (url: string): Promise<SafeResponse> => {
          if (url.endsWith('/.git/HEAD')) {
            return {
              status: 200,
              headers: new Headers(),
              body: 'ref: refs/heads/main\n',
              bytes: 21,
              url,
            }
          }
          if (url.endsWith('/.git/config')) {
            return {
              status: 200,
              headers: new Headers(),
              body: '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n',
              bytes: 47,
              url,
            }
          }
          return {
            status: 404,
            headers: new Headers(),
            body: 'Not found',
            bytes: 9,
            url,
          }
        },
      }

      const result = await gitDetector.run(mockContext)
      expect(result.status).toBe('issue_found')
      // Consolidate multiple reachable .git paths into ONE finding
      expect(result.findings).toHaveLength(1)

      const finding = result.findings[0]
      expect(finding?.type).toBe('LL-FILE-GIT')
      expect(finding?.metadata.paths).toEqual(['/.git/HEAD', '/.git/config'])
      // Objects not retrievable -> High severity
      expect(finding?.severity).toBe('high')
      expect(finding?.why).toContain('discloses repository configuration')
      expect(finding?.why).toContain('objects and history could not be directly retrieved')
    })

    it('sets severity to Critical when repository objects or history (/.git/index) can actually be retrieved', async () => {
      const mockContext = {
        target: 'https://example.com',
        verifiedHostname: 'example.com',
        discoveredAssets: [],
        detectedTechnologies: [],
        fetchText: async (url: string): Promise<SafeResponse> => {
          if (url.endsWith('/.git/HEAD')) {
            return {
              status: 200,
              headers: new Headers(),
              body: 'ref: refs/heads/main\n',
              bytes: 21,
              url,
            }
          }
          if (url.endsWith('/.git/index')) {
            // Binary Git index starting with DIRC magic header
            return {
              status: 200,
              headers: new Headers({ 'content-type': 'application/octet-stream' }),
              body: 'DIRC\x00\x00\x00\x02\x00\x00\x00...',
              bytes: 32,
              url,
            }
          }
          return {
            status: 404,
            headers: new Headers(),
            body: 'Not found',
            bytes: 9,
            url,
          }
        },
      }

      const result = await gitDetector.run(mockContext)
      expect(result.status).toBe('issue_found')
      expect(result.findings).toHaveLength(1)

      const finding = result.findings[0]
      expect(finding?.severity).toBe('critical')
      expect(finding?.metadata.canRetrieveObjects).toBe(true)
      expect(finding?.why).toContain('allow attackers to fully retrieve source code files, commit history')
    })
  })
})
