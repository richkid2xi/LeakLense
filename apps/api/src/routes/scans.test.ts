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
})
