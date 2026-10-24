import type { PrismaClient } from '@prisma/client'

export interface AuditLogEntry {
  userId?: string | null
  action: string
  hostname?: string | null
  ip: string
  metadata?: Record<string, unknown>
}

/**
 * Persists an immutable security audit log entry.
 * (Amendment f: audit log of every verification and scan; "I own this site" confirmation recorded)
 */
export async function recordAuditLog(
  entry: AuditLogEntry,
  prisma: PrismaClient,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        hostname: entry.hostname ?? null,
        ip: entry.ip,
        metadata: (entry.metadata ?? {}) as any,
      },
    })
  } catch (error) {
    // Audit logging should not crash the primary operational request, but must log error
    console.error('[AuditLog] Failed to record audit log entry:', error)
  }
}
