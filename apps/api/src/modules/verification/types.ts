import type { DEFAULT_SCAN_LIMITS, VerificationMethod } from '@leaklens/shared'
import type { SafeResponse } from '@leaklens/security'

export type SafeTextFetcher = (
  url: string,
  verifiedHostname: string,
  limits?: typeof DEFAULT_SCAN_LIMITS,
) => Promise<SafeResponse>

export interface VerificationCheckResult {
  verified: boolean
  checkedAt: string
  reason?: string
}

export interface VerificationInput {
  hostname: string
  method: VerificationMethod | string
  expectedHash: string
}
