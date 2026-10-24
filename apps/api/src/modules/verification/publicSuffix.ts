import { parse } from 'tldts'

/**
 * Explicit list of multi-tenant application hosting root platforms.
 * Rejection prevents an attacker from claiming the entire shared platform.
 */
export const KNOWN_PLATFORM_ROOTS = new Set<string>([
  'vercel.app',
  'netlify.app',
  'github.io',
  'lovable.app',
  'pages.dev',
  'firebaseapp.com',
  'web.app',
  'railway.app',
  'railway.internal',
  'up.railway.app',
  'fly.dev',
  'onrender.com',
  'render.com',
  'surge.sh',
  'glitch.me',
  'replit.app',
  'replit.dev',
  'supabase.co',
])

export type HostnameValidationResult =
  | { valid: true; hostname: string }
  | { valid: false; reason: string }

/**
 * Normalises an input domain or hostname and checks whether it is acceptable
 * for domain ownership verification.
 *
 * Rules:
 * - Must be a valid, non-empty hostname.
 * - Must not be an IP address (127.0.0.1, 8.8.8.8, etc.).
 * - Must not be a top-level domain or public suffix (e.g., .com, .co.uk).
 * - Must not be a multi-tenant platform root (e.g., vercel.app, lovable.app).
 * - Multi-tenant subdomains (e.g., my-app.vercel.app, project.lovable.app) ARE permitted.
 */
export function validateHostnameForVerification(input: string): HostnameValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'Hostname is required.' }
  }

  // Strip protocol, trailing slash, path, and port if passed
  let cleaned = input.trim().toLowerCase()
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      cleaned = new URL(cleaned).hostname
    } catch {
      return { valid: false, reason: `Invalid URL or hostname: ${input}` }
    }
  } else {
    // Strip trailing slash or path if present
    const slashIdx = cleaned.indexOf('/')
    if (slashIdx !== -1) cleaned = cleaned.slice(0, slashIdx)
    // Strip port if present
    const colonIdx = cleaned.indexOf(':')
    if (colonIdx !== -1) cleaned = cleaned.slice(0, colonIdx)
  }

  cleaned = cleaned.replace(/\.+$/, '')

  if (!cleaned) {
    return { valid: false, reason: 'Hostname cannot be empty.' }
  }

  // Reject IP addresses
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(cleaned) || cleaned.includes(':') || cleaned === 'localhost') {
    return { valid: false, reason: 'IP addresses and localhost cannot be registered for verification.' }
  }

  // Check known platform roots first
  if (KNOWN_PLATFORM_ROOTS.has(cleaned)) {
    return {
      valid: false,
      reason: `Cannot verify platform root domain '${cleaned}'. You must verify a specific subdomain (e.g. your-app.${cleaned}) or custom domain.`,
    }
  }

  // Parse against Public Suffix List (with private domains enabled)
  const parsed = parse(cleaned, { allowPrivateDomains: true })

  if (parsed.isIp) {
    return { valid: false, reason: 'IP addresses cannot be registered for verification.' }
  }

  // If the hostname itself IS the public suffix (e.g. "com", "co.uk", "vercel.app", "github.io")
  if (parsed.publicSuffix && cleaned === parsed.publicSuffix.toLowerCase()) {
    return {
      valid: false,
      reason: `Cannot verify public suffix or platform root '${cleaned}'. You must verify an apex domain or specific subdomain.`,
    }
  }

  // If there is no domain without suffix (i.e. invalid structure or bare suffix)
  if (!parsed.domain && !parsed.subdomain) {
    return {
      valid: false,
      reason: `Invalid domain structure '${cleaned}'. Verification requires a registered domain or subdomain.`,
    }
  }

  return { valid: true, hostname: cleaned }
}

export function isPlatformRootDomain(hostname: string): boolean {
  const result = validateHostnameForVerification(hostname)
  return !result.valid
}
