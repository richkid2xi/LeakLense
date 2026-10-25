import type { Finding } from './finding'
import { computeFindingFingerprint, normalizeHostname } from './fingerprint'
import type { CheckLike } from './scoring'

export type { CheckLike }

export interface FindingComparisonItem {
  fingerprint: string
  finding: Finding
  status: 'unchanged' | 'new' | 'resolved' | 'not_tested'
  label: string
}

export interface ScanComparisonResult {
  counts: {
    unchanged: number
    new: number
    resolved: number
    notTested: number
  }
  unchanged: FindingComparisonItem[]
  newFindings: FindingComparisonItem[]
  new: FindingComparisonItem[] // Alias for newFindings
  resolved: FindingComparisonItem[]
  notTested: FindingComparisonItem[]
}

/**
 * Maps finding rule type to its corresponding scanner check identifier.
 */
export function mapFindingTypeToCheckId(findingType: string): string {
  const t = (findingType || '').toUpperCase()
  if (t.startsWith('LL-SECRET') || t.startsWith('LL-KEY')) {
    return 'LL-CHECK-KEYS'
  }
  if (t.startsWith('LL-FILE-ENV') || t.includes('ENV')) {
    return 'LL-CHECK-ENV'
  }
  if (t.startsWith('LL-FILE-GIT') || t.includes('GIT')) {
    return 'LL-CHECK-GIT'
  }
  if (t.startsWith('LL-FILE-SOURCEMAP') || t.includes('SOURCEMAP') || t.includes('MAP')) {
    return 'LL-CHECK-SOURCEMAPS'
  }
  if (t.startsWith('LL-CONFIG-CORS') || t.includes('CORS')) {
    return 'LL-CHECK-CORS'
  }
  if (t.startsWith('LL-CONFIG-HEADER') || t.includes('HEADER')) {
    return 'LL-CHECK-HEADERS'
  }
  if (t.startsWith('LL-PORTAL-ADMIN') || t.includes('ADMIN')) {
    return 'LL-CHECK-ADMIN'
  }
  if (t.startsWith('LL-STORAGE') || t.includes('BUCKET')) {
    return 'LL-CHECK-BUCKETS'
  }
  if (t.startsWith('LL-AI-CLIENT') || t.includes('AI')) {
    return 'LL-CHECK-AI-CLIENT'
  }
  return 'LL-CHECK-GENERIC'
}

function normalizeCheckStatus(status: string): string {
  return (status || '').toLowerCase().replace(/['\s_-]/g, '')
}

function isCheckCouldNotTest(check?: CheckLike): boolean {
  if (!check) return false
  const s = normalizeCheckStatus(check.status)
  return s === 'couldnottest' || s === 'couldnottest'
}

/**
 * Pure function to compare two scans of a domain.
 * Given beforeScan and afterScan, classifies each finding into:
 * - Unchanged: present in both scans
 * - New: only in afterScan
 * - Resolved: in beforeScan, absent in afterScan, AND the check ran successfully in afterScan
 * - Not tested in this scan: in beforeScan, absent in afterScan, BUT the check could not run in afterScan
 */
export function compareScans(
  hostname: string,
  beforeScan: {
    findings: Finding[]
    checks?: CheckLike[]
  },
  afterScan: {
    findings: Finding[]
    checks?: CheckLike[]
  },
): ScanComparisonResult {
  const normHost = normalizeHostname(hostname)

  // Map fingerprints with findings
  const beforeMap = new Map<string, Finding>()
  for (const f of beforeScan.findings) {
    const fp = (f as any).fingerprint || computeFindingFingerprint(normHost, f)
    if (!beforeMap.has(fp)) {
      beforeMap.set(fp, f)
    }
  }

  const afterMap = new Map<string, Finding>()
  for (const f of afterScan.findings) {
    const fp = (f as any).fingerprint || computeFindingFingerprint(normHost, f)
    if (!afterMap.has(fp)) {
      afterMap.set(fp, f)
    }
  }

  // Lookup checks in afterScan by ID and synonyms
  const afterChecks = afterScan.checks || []
  const afterCheckMap = new Map<string, CheckLike>()
  for (const c of afterChecks) {
    const id = (c.checkId || (c as any).id || '').toUpperCase()
    if (id) {
      afterCheckMap.set(id, c)
      if (id === 'LL-CHECK-KEYS') afterCheckMap.set('LL-CHECK-SECRETS', c)
      if (id === 'LL-CHECK-SECRETS') afterCheckMap.set('LL-CHECK-KEYS', c)
    }
  }

  const unchanged: FindingComparisonItem[] = []
  const resolved: FindingComparisonItem[] = []
  const notTested: FindingComparisonItem[] = []
  const newFindings: FindingComparisonItem[] = []

  // Check before items against afterScan
  for (const [fp, finding] of beforeMap.entries()) {
    if (afterMap.has(fp)) {
      unchanged.push({
        fingerprint: fp,
        finding,
        status: 'unchanged',
        label: 'Unchanged',
      })
    } else {
      const checkId = mapFindingTypeToCheckId(finding.type)
      const afterCheck = afterCheckMap.get(checkId)
      if (isCheckCouldNotTest(afterCheck)) {
        notTested.push({
          fingerprint: fp,
          finding,
          status: 'not_tested',
          label: 'Not tested in this scan',
        })
      } else {
        resolved.push({
          fingerprint: fp,
          finding,
          status: 'resolved',
          label: 'Resolved',
        })
      }
    }
  }

  // Check after items not in beforeScan
  for (const [fp, finding] of afterMap.entries()) {
    if (!beforeMap.has(fp)) {
      newFindings.push({
        fingerprint: fp,
        finding,
        status: 'new',
        label: 'New',
      })
    }
  }

  return {
    counts: {
      unchanged: unchanged.length,
      new: newFindings.length,
      resolved: resolved.length,
      notTested: notTested.length,
    },
    unchanged,
    newFindings,
    new: newFindings,
    resolved,
    notTested,
  }
}
