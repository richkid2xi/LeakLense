/**
 * Passively identifies tech stack signatures from HTML, discovered assets, and response headers.
 */
export function detectTechnologies(
  html: string,
  assets: string[],
  headers?: Headers,
): string[] {
  const haystack = `${html}\n${assets.join('\n')}`.toLowerCase()
  const technologies = new Set<string>()

  if (haystack.includes('supabase.co') || haystack.includes('@supabase/')) {
    technologies.add('Supabase')
  }

  if (
    haystack.includes('firebaseapp.com') ||
    haystack.includes('firebaseio.com') ||
    haystack.includes('initializeapp(')
  ) {
    technologies.add('Firebase')
  }

  if (
    haystack.includes('/_next/') ||
    headers?.get('x-powered-by')?.toLowerCase().includes('next')
  ) {
    technologies.add('Next.js')
  }

  if (haystack.includes('/assets/index-') || haystack.includes('import.meta.env')) {
    technologies.add('Vite')
  }

  if (
    headers?.has('x-vercel-id') ||
    headers?.get('server')?.toLowerCase().includes('vercel')
  ) {
    technologies.add('Vercel')
  }

  if (
    headers?.get('server')?.toLowerCase().includes('cloudflare') ||
    headers?.has('cf-ray')
  ) {
    technologies.add('Cloudflare')
  }

  if (headers?.get('server')?.toLowerCase().includes('netlify')) {
    technologies.add('Netlify')
  }

  return [...technologies]
}
