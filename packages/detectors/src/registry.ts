import type { CheckRunResult, Detector, DetectorContext } from './types'
import { secretsDetector } from './secrets'
import { sensitiveFilesDetector } from './sensitiveFiles'
import { corsDetector } from './cors'

/**
 * Phase 1 TODO Detectors (Amendment g: Coverage Honesty)
 *
 * The scanner pipeline must NEVER report fake passes for checks that are not yet implemented.
 * If a technology is detected, report `could_not_test` with a clear explanation.
 * If the technology is absent, report `not_applicable`.
 */

export const supabaseAnonDetector: Detector = {
  id: 'LL-CHECK-SUPA-ANON',
  title: 'Supabase tables readable without login',
  category: 'Database',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const hasSupabase = context.detectedTechnologies.includes('Supabase')
    if (hasSupabase) {
      return {
        checkId: 'LL-CHECK-SUPA-ANON',
        title: 'Supabase tables readable without login',
        status: 'could_not_test',
        reason:
          'Supabase detected; public anonymous table reading inspection is planned for Phase 1 and requires an active provider adapter.',
        findings: [],
      }
    }
    return {
      checkId: 'LL-CHECK-SUPA-ANON',
      title: 'Supabase tables readable without login',
      status: 'not_applicable',
      reason: 'Supabase was not detected in this application.',
      findings: [],
    }
  },
}

export const supabaseRlsDetector: Detector = {
  id: 'LL-CHECK-SUPA-RLS',
  title: 'Missing row-level security on Supabase tables',
  category: 'Database',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const hasSupabase = context.detectedTechnologies.includes('Supabase')
    if (hasSupabase) {
      return {
        checkId: 'LL-CHECK-SUPA-RLS',
        title: 'Missing row-level security on Supabase tables',
        status: 'could_not_test',
        reason:
          'Supabase detected; table RLS inspection is planned for Phase 1 and requires an active provider adapter.',
        findings: [],
      }
    }
    return {
      checkId: 'LL-CHECK-SUPA-RLS',
      title: 'Missing row-level security on Supabase tables',
      status: 'not_applicable',
      reason: 'Supabase was not detected in this application.',
      findings: [],
    }
  },
}

export const storageDetector: Detector = {
  id: 'LL-CHECK-STORAGE',
  title: 'Public storage buckets',
  category: 'Storage',
  async run(): Promise<CheckRunResult> {
    return {
      checkId: 'LL-CHECK-STORAGE',
      title: 'Public storage buckets',
      status: 'could_not_test',
      reason:
        'Cloud storage bucket enumeration is planned for Phase 1 and requires an active provider adapter.',
      findings: [],
    }
  },
}

export const firebaseDetector: Detector = {
  id: 'LL-CHECK-FIREBASE',
  title: 'Open Firebase database rules (when Firebase is detected)',
  category: 'Database',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    const hasFirebase = context.detectedTechnologies.includes('Firebase')
    if (hasFirebase) {
      return {
        checkId: 'LL-CHECK-FIREBASE',
        title: 'Open Firebase database rules (when Firebase is detected)',
        status: 'could_not_test',
        reason:
          'Firebase detected; database rules inspection is planned for Phase 1 and requires an active provider adapter.',
        findings: [],
      }
    }
    return {
      checkId: 'LL-CHECK-FIREBASE',
      title: 'Open Firebase database rules (when Firebase is detected)',
      status: 'not_applicable',
      reason: 'Firebase was not detected in this application.',
      findings: [],
    }
  },
}

/**
 * Ordered list of all registered detectors.
 */
export const ALL_DETECTORS: Detector[] = [
  secretsDetector,
  sensitiveFilesDetector,
  corsDetector,
  supabaseAnonDetector,
  supabaseRlsDetector,
  storageDetector,
  firebaseDetector,
]

export function getDetector(id: string): Detector | undefined {
  return ALL_DETECTORS.find(d => d.id === id)
}
