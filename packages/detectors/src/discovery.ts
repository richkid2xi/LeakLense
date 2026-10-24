/**
 * Discovers public script and preload assets referenced in HTML.
 * Strictly scope-locked to the verified target hostname.
 */
export function discoverPublicAssets(
  html: string,
  pageUrl: string,
  verifiedHostname: string,
): string[] {
  const candidates = new Set<string>()
  const patterns = [
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\brel\s*=\s*["'](?:modulepreload|preload)["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi,
  ]

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (!match[1]) continue
      try {
        const url = new URL(match[1], pageUrl)
        if (
          url.hostname === verifiedHostname &&
          ['http:', 'https:'].includes(url.protocol)
        ) {
          candidates.add(url.toString())
        }
      } catch {
        // Invalid asset URLs are ignored
      }
    }
  }

  return [...candidates]
}

/**
 * Discovers a sourceMappingURL reference in an asset body.
 * Strictly scope-locked to the verified target hostname.
 */
export function discoverSourceMap(
  assetBody: string,
  assetUrl: string,
  verifiedHostname: string,
): string | null {
  const match = assetBody.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/)
  if (!match || !match[1]) return null

  try {
    const url = new URL(match[1], assetUrl)
    return url.hostname === verifiedHostname ? url.toString() : null
  } catch {
    return null
  }
}
