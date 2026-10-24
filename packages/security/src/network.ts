import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal", "instance-data"]);

const ALLOWED_PORTS = new Set(["", "80", "443"]);

export class UnsafeTargetError extends Error {
  code = "UNSAFE_TARGET";
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTargetError";
  }
}

/**
 * Normalizes a target URL and validates structural safety constraints:
 * - Scheme must be http: or https:
 * - Credentials (userinfo) are strictly prohibited
 * - Ports must be 80, 443, or default
 * - Prohibits decimal/octal/hex IP representation tricks (e.g. 2130706433, 0177.0.0.1, 0x7f.1)
 */
export function normaliseTarget(input: string): URL {
  if (!input || typeof input !== "string") {
    throw new UnsafeTargetError("A valid target string is required.");
  }

  // Reject embedded userinfo before URL parsing tricks
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*@/.test(input)) {
    throw new UnsafeTargetError("Userinfo (credentials) in target URLs are strictly forbidden.");
  }

  // Check raw hostname before URL parser converts decimal/octal integers to dotted IPs
  const rawHost = input
    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "")
    .split(/[/?:#]/)[0]!
    .split(":")[0]!
    .trim();

  // Reject single integer (decimal or hex, e.g. 2130706433, 0x7f000001)
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(rawHost)) {
    throw new UnsafeTargetError("Integer or hexadecimal IP address formats are not permitted.");
  }

  // Reject octal or hex dotted IPv4 (e.g. 0177.0.0.1, 0x7f.0.0.1)
  const rawOctets = rawHost.split(".");
  if (rawOctets.length === 4 && rawOctets.some((o) => /^0[0-9]+/i.test(o) || /^0x/i.test(o))) {
    throw new UnsafeTargetError("Octal or hexadecimal IPv4 address formats are not permitted.");
  }

  let url: URL;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    throw new UnsafeTargetError("Invalid URL format.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UnsafeTargetError("Only HTTP and HTTPS targets are supported.");
  }

  if (url.username || url.password) {
    throw new UnsafeTargetError("Credentials in target URLs are strictly forbidden.");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (!url.hostname) {
    throw new UnsafeTargetError("Target URL hostname is missing.");
  }

  if (BLOCKED_HOSTS.has(url.hostname)) {
    throw new UnsafeTargetError("Target hostname is restricted.");
  }

  // Reject single-number or hex integer hostnames like 2130706433 or 0x7f000001
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(url.hostname)) {
    throw new UnsafeTargetError("Integer/hexadecimal representation of IP addresses is not permitted.");
  }

  // Reject octal or hex IPv4 octets like 0177.0.0.1 or 0x7f.0.0.1
  const octets = url.hostname.split(".");
  if (octets.length === 4 && octets.every((o) => /^(?:0x[0-9a-f]+|\d+)$/i.test(o))) {
    for (const octet of octets) {
      if (/^0[0-9]+/i.test(octet) || /^0x/i.test(octet)) {
        throw new UnsafeTargetError("Octal or hexadecimal IPv4 address formats are not permitted.");
      }
    }
  }

  if (!url.hostname.includes(".") && isIP(url.hostname) === 0) {
    throw new UnsafeTargetError("A publicly resolvable hostname with a domain suffix is required.");
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UnsafeTargetError("Only standard web ports (80, 443) are supported.");
  }

  return url;
}

/**
 * Checks if a parsed IPv4 address falls within private, loopback, or non-routable ranges.
 */
function blockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];

  return (
    a === 0 || // 0.0.0.0/8 (Current network)
    a === 10 || // 10.0.0.0/8 (Private network)
    a === 127 || // 127.0.0.0/8 (Loopback)
    (a === 169 && b === 254) || // 169.254.0.0/16 (Link-local & Cloud metadata 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (Private network)
    (a === 192 && b === 168) || // 192.168.0.0/16 (Private network)
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (Carrier-Grade NAT / Shared)
    (a === 192 && b === 0) || // 192.0.0.0/24 (IETF assignments)
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 (Benchmark testing)
    (a === 192 && b === 2) || // 192.0.2.0/24 (TEST-NET-1)
    (a === 198 && b === 51) || // 198.51.100.0/24 (TEST-NET-2)
    (a === 203 && b === 0) || // 203.0.113.0/24 (TEST-NET-3)
    a >= 224 // 224.0.0.0/4 Multicast & 240.0.0.0/4 Reserved
  );
}

/**
 * Checks if a parsed IPv6 address falls within private, loopback, or non-routable ranges,
 * including IPv4-mapped IPv6 representations.
 */
function blockedIPv6(ip: string): boolean {
  const value = ip.toLowerCase();

  // Loopback and unspecified
  if (value === "::1" || value === "::") return true;

  // IPv4-mapped IPv6 addresses (e.g. ::ffff:10.0.0.1 or ::ffff:127.0.0.1)
  if (value.startsWith("::ffff:") || value.startsWith("0:0:0:0:0:ffff:")) {
    const rawIpv4 = value.split(":").pop();
    if (rawIpv4 && isIP(rawIpv4) === 4) {
      return blockedIPv4(rawIpv4);
    }
  }

  // Unique Local Addresses (fc00::/7 -> fc.. and fd..)
  if (value.startsWith("fc") || value.startsWith("fd")) return true;

  // Link-local unicast (fe80::/10 -> fe8, fe9, fea, feb)
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) {
    return true;
  }

  return false;
}

/**
 * Validates whether an IP address is blocked for SSRF protection.
 */
export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return blockedIPv4(address);
  if (version === 6) return blockedIPv6(address);
  // If not a recognized IP, reject by default
  return true;
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

/**
 * Resolves a hostname via DNS and asserts that every returned IP is publicly routable.
 */
export async function assertPublicHostname(hostname: string): Promise<ResolvedAddress[]> {
  let results: ResolvedAddress[];
  try {
    results = await lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new UnsafeTargetError(
      `DNS resolution failed for ${hostname}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  if (!results || results.length === 0) {
    throw new UnsafeTargetError(`The hostname ${hostname} did not resolve to any addresses.`);
  }

  const blocked = results.find((result) => isBlockedAddress(result.address));
  if (blocked) {
    throw new UnsafeTargetError(
      `The hostname ${hostname} resolves to a restricted/private address range (${blocked.address}).`
    );
  }

  return results;
}

/**
 * Verifies that an input URL targets the verified hostname and resolves to a public address.
 */
export async function assertAllowedUrl(
  input: string,
  verifiedHostname: string
): Promise<{ url: URL; resolvedAddresses: ResolvedAddress[] }> {
  const url = normaliseTarget(input);
  const normalizedVerified = verifiedHostname.toLowerCase().trim().replace(/\.$/, "");

  if (url.hostname !== normalizedVerified) {
    throw new UnsafeTargetError(
      `Target hostname (${url.hostname}) does not match the verified hostname (${normalizedVerified}).`
    );
  }

  const resolvedAddresses = await assertPublicHostname(url.hostname);
  return { url, resolvedAddresses };
}
