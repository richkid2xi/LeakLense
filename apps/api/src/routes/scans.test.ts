import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import type { PrismaClient } from '@prisma/client'
import { createApp } from '../app'

function createMockPrisma() {
  return {
    domain: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    scan: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    finding: {
      findMany: vi.fn(),
    },
    verification: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  } as unknown as PrismaClient
}

describe('scans router: ownership, verification expiry, and security controls', () => {
  it('enforces email verification before scanning (Amendment f)', async () => {
    const prisma = createMockPrisma()
    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/scans')
      .set('x-test-user-id', 'user-1')
      .set('x-test-email-verified', 'false') // Unverified email!
      .send({
        domainId: '11111111-1111-1111-1111-111111111111',
        authorized: true,
      })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('EMAIL_VERIFICATION_REQUIRED')
  })

  it('rejects scan request when "I own this site" authorized flag is missing (Amendment f)', async () => {
    const prisma = createMockPrisma()
    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/scans')
      .set('x-test-user-id', 'user-1')
      .send({
        domainId: '11111111-1111-1111-1111-111111111111',
        authorized: false,
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_SCAN_REQUEST')
  })

  it('enforces ownership scoping: user cannot scan another user domain (Amendment h)', async () => {
    const prisma = createMockPrisma()
    // User 2 owns the domain; User 1 tries to scan it
    vi.mocked(prisma.domain.findFirst).mockResolvedValue(null)
    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/scans')
      .set('x-test-user-id', 'user-1')
      .send({
        domainId: '22222222-2222-2222-2222-222222222222',
        authorized: true,
      })

    expect(res.status).toBe(404)
    expect(res.body.message).toContain('Domain not found or access denied')
  })

  it('rejects scan for unverified domain (Amendment h)', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findFirst).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      hostname: 'example.com',
      status: 'pending_verification',
      verifiedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/scans')
      .set('x-test-user-id', 'user-1')
      .send({
        domainId: '11111111-1111-1111-1111-111111111111',
        authorized: true,
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toContain('is not verified')
  })

  it('rejects scan when domain verification has expired (> 30 days) (Amendment e & h)', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findFirst).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      hostname: 'example.com',
      status: 'verified',
      verifiedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 1000), // Expired!
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/scans')
      .set('x-test-user-id', 'user-1')
      .send({
        domainId: '11111111-1111-1111-1111-111111111111',
        authorized: true,
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toContain('has expired (30-day limit)')
  })

  it('enqueues scan and records audit log when domain is verified and active (Amendment f)', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findFirst).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      hostname: 'example.com',
      status: 'verified',
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.scan.create).mockResolvedValue({
      id: 'scan-1',
      domainId: '11111111-1111-1111-1111-111111111111',
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      detectedStack: [],
      exposureScore: null,
      scoreVersion: '1.0.0',
      errorMessage: null,
      metrics: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const mockEnqueuer = vi.fn().mockResolvedValue(undefined)
    const app = createApp({ prisma, scanEnqueuer: mockEnqueuer })

    const res = await request(app)
      .post('/api/scans')
      .set('x-test-user-id', 'user-1')
      .send({
        domainId: '11111111-1111-1111-1111-111111111111',
        authorized: true,
      })

    expect(res.status).toBe(202)
    expect(res.body.scan.id).toBe('scan-1')
    expect(mockEnqueuer).toHaveBeenCalledWith({
      scanId: 'scan-1',
      domainId: '11111111-1111-1111-1111-111111111111',
      verifiedHostname: 'example.com',
    })

    // Check audit log recorded the "I own this site" affirmation
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'scan.authorize_ownership',
          hostname: 'example.com',
          metadata: expect.objectContaining({ authorized: true }),
        }),
      }),
    )
  })

  it('enforces ownership scoping on GET /scans/:id', async () => {
    const prisma = createMockPrisma()
    // Finding scan scoped to user-1 returns null if user-2 tries to fetch it
    vi.mocked(prisma.scan.findFirst).mockResolvedValue(null)
    const app = createApp({ prisma })

    const res = await request(app)
      .get('/api/scans/scan-123')
      .set('x-test-user-id', 'user-2')

    expect(res.status).toBe(404)
  })

  it('enforces owner scoping on GET /domains/:id/scans', async () => {
    const prisma = createMockPrisma()
    // Domain not found for user-2
    vi.mocked(prisma.domain.findFirst).mockResolvedValue(null)
    const app = createApp({ prisma })

    const res = await request(app)
      .get('/api/domains/11111111-1111-1111-1111-111111111111/scans')
      .set('x-test-user-id', 'user-2')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('DOMAIN_NOT_FOUND')
  })

  it('returns formatted scans on GET /domains/:id/scans for domain owner', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findFirst).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      hostname: 'example.com',
      status: 'verified',
    } as any)

    const date = new Date('2026-10-25T12:00:00Z')
    vi.mocked(prisma.scan.findMany).mockResolvedValue([
      {
        id: '22222222-2222-2222-2222-222222222222',
        domainId: '11111111-1111-1111-1111-111111111111',
        status: 'completed',
        startedAt: date,
        finishedAt: date,
        createdAt: date,
        exposureScore: 85,
        scoreVersion: '1.0.0',
        findings: [
          { severity: 'critical' },
          { severity: 'high' },
        ],
        checkRuns: [
          { status: 'could_not_test' },
          { status: 'passed' },
        ],
      } as any,
    ])

    const app = createApp({ prisma })
    const res = await request(app)
      .get('/api/domains/11111111-1111-1111-1111-111111111111/scans')
      .set('x-test-user-id', 'user-1')

    expect(res.status).toBe(200)
    expect(res.body.scans).toHaveLength(1)
    expect(res.body.scans[0].score).toBe(85)
    expect(res.body.scans[0].scoreVersion).toBe('1.0.0')
    expect(res.body.scans[0].countsBySeverity).toEqual({
      critical: 1,
      high: 1,
      medium: 0,
      low: 0,
    })
    expect(res.body.scans[0].couldNotTestCount).toBe(1)
    expect(res.body.scans[0].startedAt).toBe('2026-10-25T12:00:00.000Z')
  })

  it('validates UUIDs on GET /scans/compare?before=...&after=...', async () => {
    const prisma = createMockPrisma()
    const app = createApp({ prisma })

    const res = await request(app)
      .get('/api/scans/compare?before=invalid-uuid&after=not-a-uuid')
      .set('x-test-user-id', 'user-1')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_QUERY')
  })

  it('enforces owner-scoping on GET /scans/compare?before=...&after=...', async () => {
    const prisma = createMockPrisma()
    const scan1Id = '11111111-1111-1111-1111-111111111111'
    const scan2Id = '22222222-2222-2222-2222-222222222222'

    // scan1 belongs to user-other
    vi.mocked(prisma.scan.findUnique).mockImplementation(((args: any) => {
      if (args.where.id === scan1Id) {
        return Promise.resolve({
          id: scan1Id,
          domainId: 'd1',
          domain: { userId: 'user-other', hostname: 'victim.com' },
          findings: [],
          checkRuns: [],
        } as any)
      }
      return Promise.resolve({
        id: scan2Id,
        domainId: 'd1',
        domain: { userId: 'user-1', hostname: 'victim.com' },
        findings: [],
        checkRuns: [],
      } as any)
    }) as any)

    const app = createApp({ prisma })
    const res = await request(app)
      .get(`/api/scans/compare?before=${scan1Id}&after=${scan2Id}`)
      .set('x-test-user-id', 'user-1')

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('FORBIDDEN')
  })

  it('compares two scans accurately returning counts and lists', async () => {
    const prisma = createMockPrisma()
    const scan1Id = '11111111-1111-1111-1111-111111111111'
    const scan2Id = '22222222-2222-2222-2222-222222222222'

    const f1 = {
      id: 'f1',
      type: 'LL-SECRET-OPENAI',
      location: '/assets/index.js',
      severity: 'critical',
      maskedEvidence: { kind: 'key', maskedValue: 'sk-proj-••••••••••••1234', location: '/assets/index.js' },
    }

    vi.mocked(prisma.scan.findUnique).mockImplementation(((args: any) => {
      if (args.where.id === scan1Id) {
        return Promise.resolve({
          id: scan1Id,
          domainId: 'd1',
          exposureScore: 50,
          domain: { userId: 'user-1', hostname: 'my-app.com' },
          findings: [f1],
          checkRuns: [{ checkId: 'LL-CHECK-KEYS', status: 'issue_found' }],
        } as any)
      }
      return Promise.resolve({
        id: scan2Id,
        domainId: 'd1',
        exposureScore: 100,
        domain: { userId: 'user-1', hostname: 'my-app.com' },
        findings: [], // resolved!
        checkRuns: [{ checkId: 'LL-CHECK-KEYS', status: 'passed' }],
      } as any)
    }) as any)

    const app = createApp({ prisma })
    const res = await request(app)
      .get(`/api/scans/compare?before=${scan1Id}&after=${scan2Id}`)
      .set('x-test-user-id', 'user-1')

    expect(res.status).toBe(200)
    expect(res.body.beforeScore).toBe(50)
    expect(res.body.afterScore).toBe(100)
    expect(res.body.deltaScore).toBe(50)
    expect(res.body.counts.resolved).toBe(1)
    expect(res.body.counts.new).toBe(0)
    expect(res.body.counts.unchanged).toBe(0)
    expect(res.body.resolved).toHaveLength(1)
  })
})
