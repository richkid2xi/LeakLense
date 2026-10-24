import type { SafeResponse } from '@leaklens/security'
import type { CheckStatus, Finding } from '@leaklens/shared'

export interface DetectorContext {
  target: string
  verifiedHostname: string
  fetchText: (url: string, init?: RequestInit) => Promise<SafeResponse>
  detectedTechnologies: string[]
  discoveredAssets: string[]
  html?: string
  responseHeaders?: Headers
}

export interface CheckRunResult {
  checkId: string
  title: string
  status: CheckStatus
  reason?: string
  findings: Finding[]
}

export interface Detector {
  id: string
  title: string
  category: string
  appliesTo?: (context: DetectorContext) => boolean
  run: (context: DetectorContext) => Promise<CheckRunResult>
}
