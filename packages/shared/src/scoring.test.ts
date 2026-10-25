import { describe, it, expect } from 'vitest'
import {
  computeExposureScore,
  getScoreBand,
  SCORE_VERSION,
  SCORE_CAPTION,
} from './scoring'
import type { Finding } from './finding'

function mockFinding(
  id: string,
  type: string,
  severity: 'critical' | 'high' | 'medium' | 'low',
): Finding {
  return {
    id,
    type,
    severity,
    confidence: 'confirmed',
    status: 'open',
    location: `/test/${id}`,
    title: `Finding ${id}`,
    meaning: 'Meaning',
    why: 'Why',
    maskedEvidence: {
      kind: 'key',
      location: `/test/${id}`,
    },
    metadata: {},
    technicalSteps: [],
    steps: [],
  }
}

describe('computeExposureScore', () => {
  it('is deterministic: identical inputs yield identical output', () => {
    const findings = [
      mockFinding('1', 'LL-SECRET-OPENAI', 'critical'),
      mockFinding('2', 'LL-FILE-GIT', 'high'),
    ]
    const checks = [
      { id: 'LL-CHECK-KEYS', status: 'issue_found' },
      { id: 'LL-CHECK-GIT', status: 'issue_found' },
    ]

    const res1 = computeExposureScore(findings, checks)
    const res2 = computeExposureScore(findings, checks)

    expect(res1.score).toBe(res2.score)
    expect(res1.band).toBe(res2.band)
    expect(res1.scoreVersion).toBe(SCORE_VERSION)
  })

  it('monotonic: fixing any finding never lowers the score', () => {
    const f1 = mockFinding('1', 'LL-SECRET-OPENAI', 'critical')
    const f2 = mockFinding('2', 'LL-FILE-GIT', 'high')
    const checks = [{ id: 'LL-CHECK-KEYS', status: 'issue_found' }]

    const scoreWithBoth = computeExposureScore([f1, f2], checks).score
    const scoreWithOneFixed = computeExposureScore([f1], checks).score
    const scoreWithAllFixed = computeExposureScore([], checks).score

    expect(scoreWithOneFixed).toBeGreaterThanOrEqual(scoreWithBoth)
    expect(scoreWithAllFixed).toBeGreaterThanOrEqual(scoreWithOneFixed)
  })

  it('monotonic: adding any finding never raises the score', () => {
    const f1 = mockFinding('1', 'LL-SECRET-OPENAI', 'critical')
    const f2 = mockFinding('2', 'LL-SECRET-ANTHROPIC', 'critical')
    const checks = [{ id: 'LL-CHECK-KEYS', status: 'issue_found' }]

    const baseScore = computeExposureScore([f1], checks).score
    const scoreWithExtraFinding = computeExposureScore([f1, f2], checks).score

    expect(scoreWithExtraFinding).toBeLessThanOrEqual(baseScore)
  })

  it('caps minimum displayed score at 1 when at least one check ran', () => {
    // Extreme number of critical findings
    const findings: Finding[] = []
    for (let i = 0; i < 20; i++) {
      findings.push(mockFinding(`c-${i}`, `LL-RULE-${i}`, 'critical'))
    }
    const checks = [{ id: 'LL-CHECK-KEYS', status: 'issue_found' }]

    const result = computeExposureScore(findings, checks)
    expect(result.score).toBe(1)
    expect(result.band).toBe('critical')
    expect(result.label).toBe('Critical exposure')
  })

  it('is never above 99 if any check could not run (not fully tested)', () => {
    // 0 findings, but one check could not run
    const checks = [
      { id: 'LL-CHECK-KEYS', status: 'passed' },
      { id: 'LL-CHECK-ENV', status: 'could_not_test', reason: 'Probe timed out' },
    ]

    const result = computeExposureScore([], checks)
    expect(result.score).toBe(99)
    expect(result.isFullyTested).toBe(false)
    expect(result.couldNotTestCount).toBe(1)
  })

  it('yields 100 only when every implemented check ran and passed with zero findings', () => {
    const checks = [
      { id: 'LL-CHECK-KEYS', status: 'passed' },
      { id: 'LL-CHECK-ENV', status: 'passed' },
      { id: 'LL-CHECK-GIT', status: 'passed' },
    ]

    const result = computeExposureScore([], checks)
    expect(result.score).toBe(100)
    expect(result.isFullyTested).toBe(true)
    expect(result.couldNotTestCount).toBe(0)
    expect(result.band).toBe('low')
    expect(result.label).toBe('Low exposure in the checks we ran')
  })

  it('applies diminishing returns for repeated findings of the same type (2nd+ at 50%)', () => {
    // Two critical findings of DIFFERENT types: weight = 10 + 10 = 20
    const diffTypes = [
      mockFinding('1', 'LL-SECRET-OPENAI', 'critical'),
      mockFinding('2', 'LL-FILE-GIT', 'critical'),
    ]
    // Two critical findings of the SAME type: weight = 10 + (10 * 0.5) = 15
    const sameTypes = [
      mockFinding('1', 'LL-SECRET-OPENAI', 'critical'),
      mockFinding('2', 'LL-SECRET-OPENAI', 'critical'),
    ]
    const checks = [{ id: 'LL-CHECK-KEYS', status: 'issue_found' }]

    const scoreDiff = computeExposureScore(diffTypes, checks).score
    const scoreSame = computeExposureScore(sameTypes, checks).score

    // Diminishing returns means penalty is lower, so scoreSame is higher than scoreDiff
    expect(scoreSame).toBeGreaterThan(scoreDiff)
  })

  it('marks recalculated when stored score version differs from current', () => {
    const checks = [{ id: 'LL-CHECK-KEYS', status: 'passed' }]
    const result = computeExposureScore([], checks, { storedScoreVersion: '0.9.0' })
    expect(result.recalculated).toBe(true)

    const currentResult = computeExposureScore([], checks, { storedScoreVersion: SCORE_VERSION })
    expect(currentResult.recalculated).toBe(false)
  })
})

describe('getScoreBand', () => {
  it('maps scores to honest band labels without using secure or safe', () => {
    expect(getScoreBand(15).label).toBe('Critical exposure')
    expect(getScoreBand(45).label).toBe('High exposure')
    expect(getScoreBand(75).label).toBe('Moderate exposure')
    expect(getScoreBand(95).label).toBe('Low exposure in the checks we ran')
    expect(getScoreBand(100).caption).toBe(SCORE_CAPTION)
  })
})
