import { describe, expect, it } from 'vitest'
import { ResponseTruncatedError, type SafeResponse } from '@leaklens/security'
import {
  classifySensitiveFile,
  extractEnvVariableNames,
  sensitiveFilesDetector,
} from './index'

describe('sensitive files detector', () => {
  it('extracts variable names and NEVER stores or returns secret values (Amendment c)', () => {
    const rawEnv = `
# Production environment variables
DATABASE_URL=postgres://user:super_secret_password_123@db.example.com:5432/prod
STRIPE_API_KEY=sk_live_verysecretstripekey999
PORT=3000
    `.trim()

    const names = extractEnvVariableNames(rawEnv)
    expect(names).toEqual(['DATABASE_URL', 'STRIPE_API_KEY', 'PORT'])

    const finding = classifySensitiveFile('/.env', 200, rawEnv)
    expect(finding).not.toBeNull()
    if (!finding) return

    expect(finding.type).toBe('LL-FILE-ENV')
    expect(finding.metadata.variableNames).toEqual(['DATABASE_URL', 'STRIPE_API_KEY', 'PORT'])

    // Critical assertion: Raw passwords and values must NEVER be in finding or stringified output
    const jsonStr = JSON.stringify(finding)
    expect(jsonStr).not.toContain('super_secret_password_123')
    expect(jsonStr).not.toContain('verysecretstripekey999')
  })

  it('detects reachable Git repositories', () => {
    const gitHead = 'ref: refs/heads/main\n'
    const finding = classifySensitiveFile('/.git/HEAD', 200, gitHead)
    expect(finding).not.toBeNull()
    expect(finding?.type).toBe('LL-FILE-GIT')
  })

  it('rejects SPA HTML 200 responses to avoid false positives', () => {
    const spaHtml = '<!DOCTYPE html><html><head><title>App</title></head><body>Not found</body></html>'
    expect(classifySensitiveFile('/.env', 200, spaHtml)).toBeNull()
    expect(classifySensitiveFile('/.git/HEAD', 200, spaHtml)).toBeNull()
  })

  it('reports could_not_test on response truncation, never passed (Amendment b)', async () => {
    const mockContext = {
      target: 'https://example.com',
      verifiedHostname: 'example.com',
      discoveredAssets: [],
      detectedTechnologies: [],
      fetchText: async (): Promise<SafeResponse> => {
        throw new ResponseTruncatedError('Response exceeded 2MB limit', 2000001, 2000000)
      },
    }

    const result = await sensitiveFilesDetector.run(mockContext)
    expect(result.status).toBe('could_not_test')
    expect(result.status).not.toBe('passed')
    expect(result.reason).toContain('exceeded configured size limit')
  })
})
