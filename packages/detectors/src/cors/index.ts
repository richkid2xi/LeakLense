import type { Finding } from '@leaklens/shared'
import type { CheckRunResult, Detector, DetectorContext } from '../types'

export function evaluateCorsHeaders(headers: Headers, location: string): Finding[] {
  const origin = headers.get('access-control-allow-origin')
  const credentials = headers.get('access-control-allow-credentials')

  if (origin === '*' && credentials?.toLowerCase() === 'true') {
    return [
      {
        id: `finding-cors-${location}`,
        type: 'LL-CORS-001',
        ruleVersion: '1.0.0',
        severity: 'high',
        confidence: 'confirmed',
        status: 'open',
        location,
        title: 'Credentialed CORS policy is overly permissive',
        meaning:
          'The server combines a wildcard origin (Access-Control-Allow-Origin: *) with credentialed cross-origin access (Access-Control-Allow-Credentials: true).',
        why: 'A permissive cross-origin configuration can expose authenticated API responses to malicious third-party websites if browsers or proxy caches honor the combination.',
        maskedEvidence: {
          location,
          summary: 'Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true',
          kind: 'network',
        },
        technicalSteps: [
          'Replace the wildcard (*) with an explicit allowlist of trusted origins.',
          'Return credentialed CORS headers only on endpoints that genuinely require browser authentication.',
          'Reject origins that are not on the allowlist.',
        ],
        steps: [
          'Replace the wildcard (*) with an explicit allowlist of trusted origins.',
          'Return credentialed CORS headers only on endpoints that genuinely require browser authentication.',
          'Reject origins that are not on the allowlist.',
        ],
        verificationSteps: [
          'Send a preflight request with Origin: https://evil.com and confirm it is rejected or lacks credentials: true.',
        ],
        references: [
          {
            title: 'MDN: Cross-Origin Resource Sharing (CORS)',
            url: 'https://developer.mozilla.org/docs/Web/HTTP/CORS',
          },
        ],
        metadata: {},
      },
    ]
  }

  return []
}

export const corsDetector: Detector = {
  id: 'LL-CHECK-CORS',
  title: 'Overly permissive CORS settings',
  category: 'Network',
  async run(context: DetectorContext): Promise<CheckRunResult> {
    if (!context.responseHeaders) {
      return {
        checkId: corsDetector.id,
        title: corsDetector.title,
        status: 'passed',
        findings: [],
      }
    }

    const findings = evaluateCorsHeaders(context.responseHeaders, context.target)

    return {
      checkId: corsDetector.id,
      title: corsDetector.title,
      status: findings.length > 0 ? 'issue_found' : 'passed',
      findings,
    }
  },
}
