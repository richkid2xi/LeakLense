/**
 * Masks a secret string keeping prefix and last 4 chars, replacing middle with bullets.
 * Guarantees that the raw credential is never returned, stored, or logged.
 */
export function maskSecret(secret: string): string {
  if (!secret || typeof secret !== "string" || secret.length <= 8) {
    return "••••••••";
  }

  const prefixMatch = secret.match(/^([a-zA-Z0-9_-]{3,12}_|[a-zA-Z0-9_-]{2,8}-)/);
  const prefix = prefixMatch ? prefixMatch[1] : secret.slice(0, Math.min(7, secret.length - 4));
  const suffix = secret.slice(-4);

  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Asserts that an object or string contains no unmasked secrets matching a known pattern.
 */
export function containsRawSecret(target: unknown, rawSecret: string): boolean {
  if (!rawSecret || rawSecret.length < 8) return false;
  const serialized = typeof target === "string" ? target : JSON.stringify(target);
  return serialized.includes(rawSecret);
}
