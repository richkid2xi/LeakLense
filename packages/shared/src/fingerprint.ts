import { sha256 } from './sha256'
import type { MaskedEvidence } from './evidence'

/**
 * Normalizes a URL path or full URL by:
 * - Stripping content hashes from asset filenames (e.g. index-Bs6Dobp1.js -> index.js)
 * - Consolidating and alphabetically sorting query parameters
 * - Stripping redundant trailing slashes
 */
export function normalizeLocation(rawLocation: string): string {
  if (!rawLocation) return '/'

  let location = rawLocation.trim()

  // If a full URL was provided, extract pathname + search
  let search = ''
  try {
    if (location.startsWith('http://') || location.startsWith('https://')) {
      const parsed = new URL(location)
      location = parsed.pathname
      search = parsed.search
    }
  } catch {
    // Treat as relative path
  }

  // Extract query if not already extracted
  if (!search && location.includes('?')) {
    const parts = location.split('?')
    location = parts[0] || '/'
    search = parts.slice(1).join('?')
  }

  // Consolidate query string: sort keys alphabetically
  let normalizedSearch = ''
  if (search) {
    const cleanSearch = search.startsWith('?') ? search.slice(1) : search
    const params = new URLSearchParams(cleanSearch)
    const sortedEntries: Array<[string, string]> = []
    params.forEach((value, key) => {
      sortedEntries.push([key, value])
    })
    sortedEntries.sort((a, b) => {
      if (a[0] === b[0]) return a[1].localeCompare(b[1])
      return a[0].localeCompare(b[0])
    })
    if (sortedEntries.length > 0) {
      const canonicalParams = new URLSearchParams()
      for (const [k, v] of sortedEntries) {
        canonicalParams.append(k, v)
      }
      normalizedSearch = `?${canonicalParams.toString()}`
    }
  }

  // Normalize path segments and strip asset build content hashes
  // Matches hashes of 7+ alphanumeric chars before an extension or segment end
  // e.g. /assets/index-Bs6Dobp1.js -> /assets/index.js
  // e.g. /static/main.8f4a1c2d.css -> /static/main.css
  const segments = location.split('/')
  const normalizedSegments = segments.map((seg) => {
    if (!seg) return seg
    // Matches e.g. index-Bs6Dobp1.js -> index.js
    let cleaned = seg.replace(/[-.][a-zA-Z0-9_-]{7,}(\.(?:js|mjs|cjs|css|map|wasm|json|png|jpg|jpeg|svg|ico|woff2?))$/i, '$1')
    // Matches intermediate hashes like chunk.abcdef12.bundle.js
    cleaned = cleaned.replace(/[-.][a-zA-Z0-9_-]{7,}(?=\.[a-zA-Z0-9]+)/g, '')
    return cleaned
  })

  let normalizedPath = normalizedSegments.join('/')
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`
  }

  // Consolidate trailing slash (preserve single root '/')
  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1)
  }

  return `${normalizedPath}${normalizedSearch}`
}

/**
 * Normalizes domain hostname (lowercase, stripped protocol and port).
 */
export function normalizeHostname(hostname: string): string {
  if (!hostname) return ''
  let cleaned = hostname.trim().toLowerCase()
  cleaned = cleaned.replace(/^https?:\/\//, '')
  cleaned = cleaned.split('/')[0] || ''
  cleaned = cleaned.split(':')[0] || ''
  return cleaned
}

export interface FindingFingerprintInput {
  type: string
  location: string
  maskedEvidence?: MaskedEvidence | null
  metadata?: Record<string, unknown> | null
}

/**
 * Computes a stable fingerprint hash for a finding.
 * Inputs:
 * - Hostname (normalized)
 * - Finding type (e.g. LL-SECRET-OPENAI, LL-FILE-GIT)
 * - Normalized location (content hashes stripped, canonical query)
 * - For secrets: masked prefix + last 4 chars (never raw secrets)
 */
export function computeFindingFingerprint(
  hostname: string,
  finding: FindingFingerprintInput,
): string {
  const normHost = normalizeHostname(hostname)
  const normType = finding.type.trim()
  const normLoc = normalizeLocation(finding.location)

  let secretKeyInfo = ''
  const isSecret =
    normType.startsWith('LL-SECRET') ||
    normType.startsWith('LL-KEY') ||
    finding.maskedEvidence?.kind === 'key'

  if (isSecret && finding.maskedEvidence?.maskedValue) {
    const masked = finding.maskedEvidence.maskedValue.trim()
    // Extract prefix before bullets
    const bulletIndex = masked.indexOf('•')
    const prefix = bulletIndex > 0 ? masked.slice(0, bulletIndex) : ''
    // Extract last 4 non-bullet chars if available
    const lastBullet = masked.lastIndexOf('•')
    const suffix =
      lastBullet >= 0 && lastBullet < masked.length - 1
        ? masked.slice(lastBullet + 1)
        : masked.slice(-4)
    secretKeyInfo = `${prefix}::${suffix}`
  }

  const canonicalString = `${normHost}|${normType}|${normLoc}|${secretKeyInfo}`
  return sha256(canonicalString)
}
