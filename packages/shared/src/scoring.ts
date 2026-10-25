import type { Finding, FindingSeverity } from './finding'
import type { CheckResult, CheckRun } from './check'

export const SCORE_VERSION = '1.0.0'
export const SCORE_CAPTION = 'Based only on the checks listed. Not a full security audit.'

export type ScoreBand = 'critical' | 'high' | 'moderate' | 'low'

export interface ExposureScoreResult {
  score: number
  scoreVersion: string
  band: ScoreBand
  label: string
  caption: string
  isFullyTested: boolean
  couldNotTestCount: number
  recalculated?: boolean
}

const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
}

export type CheckLike = CheckResult | CheckRun | {
  id?: string
  checkId?: string
  title?: string
  status: string
  reason?: string | null
}

export function getScoreBand(score: number): {
  band: ScoreBand
  label: string
  caption: string
} {
  const s = Math.max(0, Math.min(100, Math.round(score)))
  if (s <= 29) {
    return {
      band: 'critical',
      label: 'Critical exposure',
      caption: SCORE_CAPTION,
    }
  }
  if (s <= 59) {
    return {
      band: 'high',
      label: 'High exposure',
      caption: SCORE_CAPTION,
    }
  }
  if (s <= 84) {
    return {
      band: 'moderate',
      label: 'Moderate exposure',
      caption: SCORE_CAPTION,
    }
  }
  return {
    band: 'low',
    label: 'Low exposure in the checks we ran',
    caption: SCORE_CAPTION,
  }
}

/**
 * Pure function to compute exposure score (0 - 100).
 * Inputs:
 * - findings: list of findings (deduplicated by fingerprint or unique ID)
 * - checks: list of checks that ran
 *
 * Formula:
 * - Weights: critical: 10, high: 5, medium: 2, low: 1
 * - Diminishing returns: 1st of a type = 100%, 2nd+ of same type = 50%
 * - Raw score = round(100 * exp(-totalWeight / 25))
 * - Minimum displayed score is capped at 1 when at least one check ran
 * - Maximum score is capped at 99 if any check could not run (not fully tested)
 * - 100 only when every implemented check ran and passed with zero findings
 */
export function computeExposureScore(
  findings: Finding[] = [],
  checks: CheckLike[] = [],
  options?: {
    storedScoreVersion?: string | null
  },
): ExposureScoreResult {
  // Deduplicate findings by fingerprint (fallback to type::location)
  const seenKeys = new Set<string>()
  const dedupedFindings: Finding[] = []

  for (const f of findings) {
    const key = (f as any).fingerprint || `${f.type}::${f.location}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      dedupedFindings.push(f)
    }
  }

  // Count checks that could not run
  let couldNotTestCount = 0
  for (const c of checks) {
    const status = (c.status || '').toLowerCase().replace(/['\s_-]/g, '')
    if (status === 'couldnottest') {
      couldNotTestCount++
    }
  }

  const isFullyTested = couldNotTestCount === 0

  // Group findings by type to apply diminishing returns (2nd+ count at 50%)
  const byType = new Map<string, Finding[]>()
  for (const f of dedupedFindings) {
    const list = byType.get(f.type) || []
    list.push(f)
    byType.set(f.type, list)
  }

  let totalWeight = 0
  for (const [, list] of byType.entries()) {
    // Sort descending by weight so the highest severity gets the 100% weight
    list.sort((a, b) => {
      const wa = SEVERITY_WEIGHTS[a.severity] ?? 1
      const wb = SEVERITY_WEIGHTS[b.severity] ?? 1
      return wb - wa
    })

    list.forEach((f, idx) => {
      const baseWeight = SEVERITY_WEIGHTS[f.severity] ?? 1
      const multiplier = idx === 0 ? 1 : 0.5
      totalWeight += baseWeight * multiplier
    })
  }

  let score: number
  if (dedupedFindings.length === 0) {
    if (!isFullyTested) {
      score = 99
    } else {
      score = 100
    }
  } else {
    const raw = Math.round(100 * Math.exp(-totalWeight / 25))
    // Cap minimum displayed score at 1 when at least one check ran
    score = checks.length > 0 ? Math.max(1, raw) : raw
    // Cap score at 99 if any check could not run
    if (!isFullyTested && score > 99) {
      score = 99
    }
  }

  const bandInfo = getScoreBand(score)
  const recalculated = Boolean(
    options?.storedScoreVersion && options.storedScoreVersion !== SCORE_VERSION,
  )

  return {
    score,
    scoreVersion: SCORE_VERSION,
    band: bandInfo.band,
    label: bandInfo.label,
    caption: bandInfo.caption,
    isFullyTested,
    couldNotTestCount,
    recalculated,
  }
}
