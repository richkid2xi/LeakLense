import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  assertDomainScanEligible,
  checkDomainVerification,
  startDomainVerification,
  VerificationError,
} from './service'

function createMockPrisma() {
  return {
    domain: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    verification: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaClient
}

describe('verification service', () => {
  describe('startDomainVerification', () => {
    it('throws 404 when domain does not belong to the user', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue(null)

      await expect(
        startDomainVerification('user-1', 'domain-1', 'dns_txt', prisma),
      ).rejects.toThrow(VerificationError)
    })

    it('rejects platform root domains', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue({
        id: 'domain-1',
        userId: 'user-1',
        hostname: 'vercel.app',
        status: 'pending_verification',
        verifiedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(
        startDomainVerification('user-1', 'domain-1', 'dns_txt', prisma),
      ).rejects.toThrow(/Cannot verify platform root domain/)
    })

    it('generates a 30-day challenge and returns details for a valid domain', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue({
        id: 'domain-1',
        userId: 'user-1',
        hostname: 'my-app.vercel.app',
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
        token: 'll_testtoken123',
        tokenHash: 'somehash',
        tokenPreview: 'll_test••••n123',
        status: 'pending',
        attempts: 0,
        lastError: null,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await startDomainVerification('user-1', 'domain-1', 'dns_txt', prisma)
      expect(res.verificationId).toBe('verif-1')
      expect(res.details.dnsRecord.host).toBe('_leaklens.my-app.vercel.app')
      expect(res.details.method).toBe('dns_txt')
    })
  })

  describe('checkDomainVerification', () => {
    it('marks expired challenges as expired', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue({
        id: 'domain-1',
        userId: 'user-1',
        hostname: 'example.com',
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
        token: 'll_tok',
        tokenHash: 'hash',
        tokenPreview: 'll_tok••••',
        status: 'pending',
        attempts: 0,
        lastError: null,
        verifiedAt: null,
        expiresAt: new Date(Date.now() - 1000), // expired
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await checkDomainVerification('user-1', 'domain-1', prisma)
      expect(result.verified).toBe(false)
      expect(result.reason).toContain('expired')
      expect(prisma.verification.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'expired' }) }),
      )
    })

    it('updates domain and verification on successful check', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue({
        id: 'domain-1',
        userId: 'user-1',
        hostname: 'example.com',
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
        token: 'll_tok',
        tokenHash: 'hash',
        tokenPreview: 'll_tok••••',
        status: 'pending',
        attempts: 0,
        lastError: null,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const mockVerifier = vi.fn().mockResolvedValue({
        verified: true,
        checkedAt: new Date().toISOString(),
      })

      const result = await checkDomainVerification('user-1', 'domain-1', prisma, mockVerifier)
      expect(result.verified).toBe(true)
      expect(prisma.domain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'verified' }),
        }),
      )
    })
  })

  describe('assertDomainScanEligible', () => {
    it('throws 403 when domain is unverified', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue({
        id: 'domain-1',
        userId: 'user-1',
        hostname: 'example.com',
        status: 'pending_verification',
        verifiedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(assertDomainScanEligible('domain-1', 'user-1', prisma)).rejects.toThrow(
        /is not verified/,
      )
    })

    it('throws 403 when verification has expired (> 30 days)', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue({
        id: 'domain-1',
        userId: 'user-1',
        hostname: 'example.com',
        status: 'verified',
        verifiedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1000), // Expired!
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(assertDomainScanEligible('domain-1', 'user-1', prisma)).rejects.toThrow(
        /has expired \(30-day limit\)/,
      )
      expect(prisma.domain.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'expired' } }),
      )
    })

    it('returns eligible when domain is verified and not expired', async () => {
      const prisma = createMockPrisma()
      vi.mocked(prisma.domain.findFirst).mockResolvedValue({
        id: 'domain-1',
        userId: 'user-1',
        hostname: 'example.com',
        status: 'verified',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await assertDomainScanEligible('domain-1', 'user-1', prisma)
      expect(res.eligible).toBe(true)
      expect(res.domain.hostname).toBe('example.com')
    })
  })
})
