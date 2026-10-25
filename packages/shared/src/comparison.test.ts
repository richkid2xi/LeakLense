import { describe, it, expect } from 'vitest'
import { compareScans } from './comparison'
import type { Finding } from './finding'

function makeMockFinding(id: string, type: string, location: string, maskedValue?: string): Finding {
  return {
    id,
    type,
    location,
    severity: 'high',
    confidence: 'confirmed',
    status: 'open',
    title: `Mock finding ${id}`,
    meaning: 'Mock meaning',
    why: 'Mock why',
    maskedEvidence: {
      kind: 'key',
      location,
      maskedValue: maskedValue || 'sk-proj-••••••••••••1234',
    },
    metadata: {},
    technicalSteps: [],
    steps: [],
  }
}

describe('compareScans pure function', () => {
  it('yields 0 new, 0 resolved, and N unchanged when comparing a scan with itself', () => {
    const f1 = makeMockFinding('f1', 'LL-SECRET-OPENAI', '/assets/index-Bs6Dobp1.js')
    const f2 = makeMockFinding('f2', 'LL-FILE-GIT', '/.git/HEAD')
    const findings = [f1, f2]
    const checks = [
      { id: 'LL-CHECK-KEYS', checkId: 'LL-CHECK-KEYS', status: 'issue_found' },
      { id: 'LL-CHECK-GIT', checkId: 'LL-CHECK-GIT', status: 'issue_found' },
    ]

    const result = compareScans(
      'example.com',
      { findings, checks },
      { findings, checks },
    )

    expect(result.counts.new).toBe(0)
    expect(result.counts.resolved).toBe(0)
    expect(result.counts.notTested).toBe(0)
    expect(result.counts.unchanged).toBe(2)
    expect(result.unchanged).toHaveLength(2)
    expect(result.newFindings).toHaveLength(0)
    expect(result.resolved).toHaveLength(0)
    expect(result.notTested).toHaveLength(0)
  })

  it('yields 0 new, 0 resolved, and N unchanged when comparing two scans of an unchanged site across redeploys', () => {
    const beforeFinding = makeMockFinding('f1', 'LL-SECRET-OPENAI', '/assets/index-Bs6Dobp1.js')
    // After redeploy, Vite changed asset hash from Bs6Dobp1 to 9kL2mNoP
    const afterFinding = makeMockFinding('f2', 'LL-SECRET-OPENAI', '/assets/index-9kL2mNoP.js')

    const result = compareScans(
      'example.com',
      { findings: [beforeFinding] },
      { findings: [afterFinding] },
    )

    expect(result.counts.new).toBe(0)
    expect(result.counts.resolved).toBe(0)
    expect(result.counts.unchanged).toBe(1)
  })

  it('correctly marks a finding as Resolved when absent in afterScan and the check passed', () => {
    const beforeFindings = [
      makeMockFinding('f1', 'LL-SECRET-OPENAI', '/assets/index.js'),
    ]
    const afterFindings: Finding[] = []
    const afterChecks = [
      { checkId: 'LL-CHECK-KEYS', status: 'passed' },
    ]

    const result = compareScans(
      'example.com',
      { findings: beforeFindings },
      { findings: afterFindings, checks: afterChecks },
    )

    expect(result.counts.resolved).toBe(1)
    expect(result.counts.notTested).toBe(0)
    expect(result.counts.new).toBe(0)
    expect(result.counts.unchanged).toBe(0)
    expect(result.resolved[0]?.status).toBe('resolved')
    expect(result.resolved[0]?.label).toBe('Resolved')
  })

  it('marks a missing finding as "Not tested in this scan" (NOT resolved) when its check could_not_test', () => {
    const beforeFindings = [
      makeMockFinding('f1', 'LL-FILE-GIT', '/.git/HEAD'),
    ]
    const afterFindings: Finding[] = []
    // The git probe timed out or was blocked in the subsequent scan
    const afterChecks = [
      { checkId: 'LL-CHECK-GIT', status: 'could_not_test', reason: 'Connection timed out' },
    ]

    const result = compareScans(
      'example.com',
      { findings: beforeFindings },
      { findings: afterFindings, checks: afterChecks },
    )

    expect(result.counts.resolved).toBe(0)
    expect(result.counts.notTested).toBe(1)
    expect(result.notTested[0]?.status).toBe('not_tested')
    expect(result.notTested[0]?.label).toBe('Not tested in this scan')
  })

  it('identifies newly introduced findings in afterScan', () => {
    const beforeFindings: Finding[] = []
    const afterFindings = [
      makeMockFinding('f-new', 'LL-CONFIG-CORS', '/api/data'),
    ]

    const result = compareScans(
      'example.com',
      { findings: beforeFindings },
      { findings: afterFindings },
    )

    expect(result.counts.new).toBe(1)
    expect(result.newFindings[0]?.status).toBe('new')
    expect(result.newFindings[0]?.label).toBe('New')
  })
})
