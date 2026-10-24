import { CheckResult, Finding } from "@leaklens/shared";

export interface ScanContext {
  scanId: string;
  verifiedHostname: string;
  targetUrl: string;
  detectedStack: string[];
  /**
   * SSRF-safe HTTP client interface:
   * - Enforces scope lock to verified hostname only
   * - Blocks loopback, private RFC 1918, link-local, and cloud metadata ranges
   * - Re-verifies IP resolution after redirects
   * - Strict timeout (max 5s) and response size cap (max 2MB)
   */
  safeFetch: (pathOrUrl: string, init?: RequestInit) => Promise<Response>;
}

export type DetectorApplicability = { applies: true } | { applies: false; reason: string };

export interface Detector {
  id: string; // e.g. "LL-CHECK-KEYS", "LL-CHECK-SUPA-ANON"
  title: string;
  category: "Secrets" | "Database" | "Storage" | "Configuration" | "Network";
  appliesTo: (context: ScanContext) => DetectorApplicability | Promise<DetectorApplicability>;
  run: (context: ScanContext) => Promise<{
    checkResult: CheckResult;
    findings: Finding[];
  }>;
}
