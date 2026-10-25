import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { processScanJob } from './queue'

function createMockPrisma() {
  return {
    domain: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scan: {
      update: vi.fn(),
    },
    checkRun: {
      create: vi.fn(),
    },
    finding: {
      create: vi.fn(),
    },
  } as unknown as PrismaClient
}

describe('processScanJob & queue', () => {
  it('fails scan if domain is not found', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findUnique).mockResolvedValue(null)

    await processScanJob(
      { scanId: 'scan-1', domainId: 'domain-1', verifiedHostname: 'example.com' },
      prisma,
    )

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'scan-1' },
        data: expect.objectContaining({ status: 'failed', errorMessage: expect.stringContaining('not found') }),
      }),
    )
  })

  it('fails scan if domain is unverified (Amendment e)', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findUnique).mockResolvedValue({
      id: 'domain-1',
      hostname: 'example.com',
      status: 'pending_verification',
      verifiedAt: null,
      expiresAt: null,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const mockScanRunner = vi.fn()

    await processScanJob(
      { scanId: 'scan-1', domainId: 'domain-1', verifiedHostname: 'example.com' },
      prisma,
      mockScanRunner,
    )

    expect(mockScanRunner).not.toHaveBeenCalled()
    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('is not verified'),
        }),
      }),
    )
  })

  it('fails scan if domain verification has expired (> 30 days) (Amendment e)', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findUnique).mockResolvedValue({
      id: 'domain-1',
      hostname: 'example.com',
      status: 'verified',
      verifiedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Expired 5 days ago
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const mockScanRunner = vi.fn()

    await processScanJob(
      { scanId: 'scan-1', domainId: 'domain-1', verifiedHostname: 'example.com' },
      prisma,
      mockScanRunner,
    )

    expect(mockScanRunner).not.toHaveBeenCalled()
    expect(prisma.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'domain-1' },
        data: { status: 'expired' },
      }),
    )
    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('has expired (30-day limit)'),
        }),
      }),
    )
  })

  it('runs scan and persists results when domain is verified and active', async () => {
    const prisma = createMockPrisma()
    vi.mocked(prisma.domain.findUnique).mockResolvedValue({
      id: 'domain-1',
      hostname: 'example.com',
      status: 'verified',
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // Valid for 20 more days
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const mockScanRunner = vi.fn().mockResolvedValue({
      target: 'https://example.com',
      detectedStack: ['Vercel', 'Next.js'],
      checks: [
        { id: 'LL-CHECK-KEYS', checkId: 'LL-CHECK-KEYS', title: 'Keys', status: 'passed' },
      ],
      findings: [
        {
          id: 'finding-1',
          type: 'LL-CORS-001',
          severity: 'high',
          status: 'open',
          location: 'https://example.com',
          title: 'Permissive CORS',
          meaning: 'Wildcard with credentials',
          why: 'Security risk',
          maskedEvidence: { location: 'https://example.com', summary: 'CORS header', kind: 'network' },
          technicalSteps: ['Fix CORS'],
          verificationSteps: ['Test CORS'],
          references: [],
          metadata: {},
        },
      ],
      exposureScore: 85,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      metrics: { assetsFetched: 3, bytesRead: 50000, requestsMade: 4 },
    })

    await processScanJob(
      { scanId: 'scan-1', domainId: 'domain-1', verifiedHostname: 'example.com' },
      prisma,
      mockScanRunner,
    )

    expect(mockScanRunner).toHaveBeenCalledWith(
      'https://example.com',
      'example.com',
      expect.objectContaining({ onProgress: expect.any(Function) }),
    )
    expect(prisma.checkRun.create).toHaveBeenCalledTimes(1)
    expect(prisma.finding.create).toHaveBeenCalledTimes(1)
    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'scan-1' },
        data: expect.objectContaining({
          status: 'completed',
          exposureScore: 85,
          detectedStack: ['Vercel', 'Next.js'],
        }),
      }),
    )
  })
})
