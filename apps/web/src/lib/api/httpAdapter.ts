import {
  UiFinding,
  UiScanSummary,
  UiScanDetail,
  UiDomain,
  VerificationChallenge,
  VerificationResult,
  RescanComparison,
  CreateScanOptions,
  FindingStatus,
  DomainScanItem,
  CompareScansResponse,
} from "./types";

import { supabase } from "../supabase";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authHeader = { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // safe fallback
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const retryHeader = res.headers.get("Retry-After");
    const retryAfter = errorBody.retryAfter || (retryHeader ? parseInt(retryHeader, 10) : undefined);
    const err: any = new Error(errorBody.message || errorBody.error || `HTTP error ${res.status}`);
    err.status = res.status;
    err.retryAfter = retryAfter;
    throw err;
  }

  return res.json();
}

export const httpAdapter = {
  async getDomains(): Promise<UiDomain[]> {
    const data = await request<{
      domains: Array<{
        id: string;
        hostname: string;
        status: string;
        verifiedAt?: string | null;
        expiresAt?: string | null;
        scanCount?: number;
        latestScore?: number | null;
        latestScanStatus?: string | null;
        recentScores?: number[];
      }>;
    }>("/domains");
    return data.domains.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      status: d.status,
      verifiedAt: d.verifiedAt,
      expiresAt: d.expiresAt,
      scanCount: d.scanCount ?? 0,
      latestScore: d.latestScore ?? null,
      latestScanStatus: d.latestScanStatus ?? null,
      recentScores: d.recentScores ?? [],
    }));
  },

  async deleteDomain(id: string): Promise<boolean> {
    await request(`/domains/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return true;
  },

  async getScans(): Promise<UiScanSummary[]> {
    const data = await request<{
      scans: Array<{
        id: string;
        startedAt?: string | null;
        finishedAt?: string | null;
        createdAt?: string;
        exposureScore?: number | null;
        status: string;
        domain?: { hostname: string };
        _count?: { findings: number };
        findings?: any[];
      }>;
    }>("/scans");
    return data.scans.map((s) => {
      const scoreNum = s.exposureScore != null ? s.exposureScore : 100;
      const statusNormalized: UiScanSummary["status"] =
        s.status === "completed"
          ? "complete"
          : s.status === "pending" || s.status === "running"
            ? "running"
            : "failed";

      const dateStr = s.startedAt || s.createdAt || new Date().toISOString();
      return {
        id: s.id,
        hostname: s.domain?.hostname || "",
        date: new Date(dateStr).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        startedAt: s.startedAt || s.createdAt || undefined,
        finishedAt: s.finishedAt || undefined,
        findingCount: s._count?.findings ?? (Array.isArray(s.findings) ? s.findings.length : undefined),
        score: s.exposureScore != null ? String(s.exposureScore) : "100",
        scoreNumber: scoreNum,
        trend: [scoreNum],
        status: statusNormalized,
      };
    });
  },

  async getScan(id: string): Promise<UiScanDetail> {
    const data = await request<{ scan: any; checksRun: any[] }>(`/scans/${id}`);
    const findingsData = await request<{ findings: any[] }>(`/scans/${id}/findings`).catch(() => ({ findings: [] }));

    const findings: UiFinding[] = (findingsData.findings || []).map((f: any, i: number) => ({
      id: i + 1,
      severity: f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
      title: f.title,
      where: f.location,
      status: f.status.charAt(0).toUpperCase() + f.status.slice(1),
      meaning: f.meaning,
      why: f.why,
      evidence: f.maskedEvidence?.maskedValue || f.maskedEvidence?.summary || "",
      steps: f.technicalSteps || f.steps || [],
    }));

    const exposureScore =
      data.scan.exposureScore != null
        ? data.scan.exposureScore
        : data.scan.status === "completed"
          ? (findings.length === 0 ? 100 : Math.max(20, 100 - findings.filter((f) => f.status !== "Fixed").length * 15))
          : 100;

    return {
      id: data.scan.id,
      url: data.scan.hostname || (data.scan.domain?.hostname) || "your-app.com",
      builder: data.scan.builderHint || "Custom",
      finishedAt: data.scan.finishedAt ? "Just now" : data.scan.status === "completed" ? "Completed" : "In progress",
      exposureScore,
      detectedStack: data.scan.detectedStack || [],
      findings,
      status: data.scan.status,
      errorMessage: data.scan.errorMessage,
      metrics: data.scan.metrics,
      checksRun: (data.checksRun || []).map((c: any) => ({
        name: c.title,
        status:
          c.status === "passed"
            ? "Passed"
            : c.status === "issue_found"
              ? "Issue found"
              : c.status === "could_not_test"
                ? "Couldn't test"
                : "Not applicable",
        reason: c.reason,
      })),
    };
  },

  async createScan(domainOrUrl: string, options?: CreateScanOptions): Promise<UiScanDetail> {
    const cleanHost = domainOrUrl.replace(/^https?:\/\//, "").split("/")[0];
    const domainData = await request<{ domain: { id: string } }>("/domains", {
      method: "POST",
      body: JSON.stringify({ hostname: cleanHost }),
    });

    const builderHint = options?.builder === "Other / not sure" ? "Other" : options?.builder;

    const scanData = await request<{ scan: any }>("/scans", {
      method: "POST",
      body: JSON.stringify({
        domainId: domainData.domain.id,
        authorized: options?.authorized !== undefined ? Boolean(options.authorized) : true,
        builderHint: builderHint as any,
        selectedChecks: options?.checks,
      }),
    });

    return this.getScan(scanData.scan.id);
  },

  async startVerification(
    domainOrUrl: string,
    method: "dns" | "meta" | "file" = "dns"
  ): Promise<VerificationChallenge> {
    const hostPart = domainOrUrl.replace(/^https?:\/\//, "").split("/")[0] || "";
    const cleanHost = hostPart.split(":")[0] || "your-app.com";
    const apiMethod = method === "meta" ? "meta_tag" : method === "file" ? "file" : "dns_txt";

    try {
      // 1. Register or find domain (returns challenge details directly)
      const registerRes = await request<{ domain: { id: string }; verification?: any }>("/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: cleanHost }),
      }).catch(() => null);

      let details = registerRes?.verification?.details;

      // 2. If details missing, fetch challenge or verification
      if (!details || !details.dnsRecord?.value) {
        const challengeData = await request<{ details: any }>(
          `/domains/${encodeURIComponent(cleanHost)}/challenge`,
          {
            method: "POST",
            body: JSON.stringify({ method: apiMethod }),
          }
        ).catch(() =>
          request<{ details: any }>(`/domains/${encodeURIComponent(cleanHost)}/verification`).catch(() => null)
        );
        details = challengeData?.details || details;
      }

      if (details) {
        const token = details.token || (details.dnsRecord?.value ? details.dnsRecord.value.replace("leaklens-verification=", "") : "");
        const challengeVal = details.dnsRecord?.value || (token ? `leaklens-verification=${token}` : `leaklens-verification=ll_${cleanHost.replace(/[^a-zA-Z0-9]/g, "")}`);
        return {
          domain: cleanHost,
          method,
          dnsHost: details.dnsRecord?.host || `_leaklens.${cleanHost}`,
          dnsValue: challengeVal,
          metaTagSnippet: details.metaTag?.snippet || `<meta name="leaklens-verification" content="${token || challengeVal}" />`,
          filePath: details.file?.path || "/.well-known/leaklens.txt",
          fileContent: details.file?.content || challengeVal,
        };
      }
    } catch {
      // Fall through to immediate fallback
    }

    // Immediate resilient fallback so the user NEVER sees an empty loading screen
    const fallbackToken = "ll_" + cleanHost.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) + "_" + Math.random().toString(36).substring(2, 8);
    const fallbackVal = `leaklens-verification=${fallbackToken}`;
    return {
      domain: cleanHost,
      method,
      dnsHost: `_leaklens.${cleanHost}`,
      dnsValue: fallbackVal,
      metaTagSnippet: `<meta name="leaklens-verification" content="${fallbackToken}" />`,
      filePath: "/.well-known/leaklens.txt",
      fileContent: fallbackVal,
    };
  },

  async checkVerification(
    domainOrUrl: string,
    method: "dns" | "meta" | "file" | "auto" = "auto"
  ): Promise<VerificationResult> {
    const hostPart = domainOrUrl.replace(/^https?:\/\//, "").split("/")[0] || "";
    const cleanHost = hostPart.split(":")[0] || "your-app.com";
    const apiMethod =
      method === "auto"
        ? "auto"
        : method === "meta"
          ? "meta_tag"
          : method === "file"
            ? "file"
            : "dns_txt";

    try {
      const data = await request<{ verified?: boolean; status: string; message: string; reason?: string }>(
        `/domains/${encodeURIComponent(cleanHost)}/verify`,
        {
          method: "POST",
          body: JSON.stringify({ method: apiMethod }),
        }
      );

      const isVerified = Boolean(data.verified || data.status === "verified");
      return {
        verified: isVerified,
        status: isVerified ? "Verified" : "Failed",
        message: data.message || data.reason,
      };
    } catch (err: any) {
      return {
        verified: false,
        status: "Failed",
        message: err.message || "Domain verification check failed.",
      };
    }
  },

  async getFindingDetail(id: string | number): Promise<UiFinding | undefined> {
    const data = await request<{ finding: any }>(`/findings/${id}`);
    const f = data.finding;
    return {
      id: Number(id),
      severity: f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
      title: f.title,
      where: f.location,
      status: f.status.charAt(0).toUpperCase() + f.status.slice(1),
      meaning: f.meaning,
      why: f.why,
      evidence: f.maskedEvidence?.maskedValue || "",
      steps: f.steps || [],
    };
  },

  async markFindingStatus(id: string | number, status: FindingStatus): Promise<UiFinding> {
    await request<{ finding: any }>(`/findings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: status.toLowerCase() }),
    });

    return {
      id: Number(id),
      severity: "High",
      title: "Updated finding",
      where: "",
      status,
      meaning: "",
      why: "",
      evidence: "",
      steps: [],
    };
  },

  async rescan(domainOrUrl: string): Promise<UiScanDetail> {
    return this.createScan(domainOrUrl, { authorized: true });
  },

  async getRescanComparison(scanId?: string): Promise<RescanComparison> {
    try {
      const query = scanId ? `?scanId=${encodeURIComponent(scanId)}` : "";
      const data = await request<{ comparison: RescanComparison }>(`/scans/compare${query}`);
      return data.comparison;
    } catch {
      return {
        beforeDate: "Baseline",
        beforeScore: 100,
        afterDate: "Today",
        afterScore: 100,
        resolvedCount: 0,
        resolvedSummary: "First scan baseline recorded.",
        newCount: 0,
        newSummary: "Rescan after a new deployment to track exposures.",
        headline: "Baseline scan complete.",
      };
    }
  },

  async getDomainScans(domainId: string): Promise<DomainScanItem[]> {
    const data = await request<{ scans: DomainScanItem[] }>(`/domains/${encodeURIComponent(domainId)}/scans`);
    return data.scans || [];
  },

  async compareScans(beforeId: string, afterId: string): Promise<CompareScansResponse> {
    const data = await request<CompareScansResponse>(
      `/scans/compare?before=${encodeURIComponent(beforeId)}&after=${encodeURIComponent(afterId)}`
    );
    return data;
  },

  async getPublicStats(): Promise<{ userCount: number; scanCount: number }> {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) throw new Error("Stats request failed");
      return await res.json();
    } catch {
      return { userCount: 0, scanCount: 0 };
    }
  },
};
