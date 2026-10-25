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

describe('domains router: platform root rejection and ownership', () => {
  it('rejects platform root domain creation (Amendment e)', async () => {
    const prisma = createMockPrisma()
    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/domains')
      .set('x-test-user-id', 'user-1')
      .send({ hostname: 'vercel.app' })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('INVALID_HOSTNAME')
    expect(res.body.message).toContain('Cannot verify platform root domain')
  })

  it('rejects invalid hostname syntax', async () => {
    const prisma = createMockPrisma()
    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/domains')
      .set('x-test-user-id', 'user-1')
      .send({ hostname: 'not a valid hostname!' })

    expect(res.status).toBe(400)
  })

  it('registers valid subdomain on platform and generates challenge', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.domain.create).mockResolvedValue({
      id: 'domain-1',
      userId: 'user-1',
      hostname: 'my-project.lovable.app',
      status: 'pending_verification',
      verifiedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.domain.findFirst).mockResolvedValue({
      id: 'domain-1',
      userId: 'user-1',
      hostname: 'my-project.lovable.app',
      status: 'pending_verification',
      verifiedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.verification.create).mockResolvedValue({
      id: 'verif-1',
      domainId: 'domain-1',
      method: 'dns_txt',
      token: 'll_test123',
      tokenHash: 'hash123',
      tokenPreview: 'll_test••••123',
      status: 'pending',
      attempts: 0,
      lastError: null,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/domains')
      .set('x-test-user-id', 'user-1')
      .send({ hostname: 'my-project.lovable.app' })

    expect(res.status).toBe(201)
    expect(res.body.domain.hostname).toBe('my-project.lovable.app')
    expect(res.body.verification.details.dnsRecord.host).toBe('_leaklens.my-project.lovable.app')
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'domain.create', hostname: 'my-project.lovable.app' }),
      }),
    )
  })

  it('rejects domain conflict when registered by another user', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findUnique).mockResolvedValue({
      id: 'domain-1',
      userId: 'other-user',
      hostname: 'example.com',
      status: 'verified',
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/domains')
      .set('x-test-user-id', 'user-1')
      .send({ hostname: 'example.com' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('DOMAIN_CONFLICT')
  })

  it('generates real-time verification challenge for meta_tag and file methods', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findFirst).mockResolvedValue({
      id: 'domain-1',
      userId: 'user-1',
      hostname: 'my-project.lovable.app',
      status: 'pending_verification',
      verifiedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.domain.update).mockResolvedValue({
      id: 'domain-1',
      userId: 'user-1',
      hostname: 'my-project.lovable.app',
      status: 'pending_verification',
      verifiedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.verification.create).mockResolvedValue({
      id: 'verif-2',
      domainId: 'domain-1',
      method: 'meta_tag',
      token: 'll_testmeta456',
      tokenHash: 'hash456',
      tokenPreview: 'll_test••••456',
      status: 'pending',
      attempts: 0,
      lastError: null,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/domains/domain-1/challenge')
      .set('x-test-user-id', 'user-1')
      .send({ method: 'meta_tag' })

    expect(res.status).toBe(200)
    expect(res.body.details.method).toBe('meta_tag')
    expect(res.body.details.metaTag.snippet).toContain('<meta name="leaklens-verification"')
  })

  it('runs real verification check and returns detailed live failure reason when record is missing', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findFirst).mockResolvedValue({
      id: 'domain-1',
      userId: 'user-1',
      hostname: 'my-project.lovable.app',
      status: 'pending_verification',
      verifiedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.verification.findFirst).mockResolvedValue({
      id: 'verif-1',
      domainId: 'domain-1',
      method: 'dns_txt',
      token: 'll_token123',
      tokenHash: 'hash123',
      tokenPreview: 'll_tok••••',
      status: 'pending',
      attempts: 0,
      lastError: null,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.verification.update).mockResolvedValue({} as any)
    vi.mocked(prisma.domain.update).mockResolvedValue({} as any)

    const app = createApp({ prisma })

    const res = await request(app)
      .post('/api/domains/domain-1/verify')
      .set('x-test-user-id', 'user-1')
      .send({ method: 'dns_txt' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('failed')
    expect(res.body.verified).toBe(false)
    expect(res.body.reason).toBeDefined()
  })
})

