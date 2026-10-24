import {
  UiFinding,
  UiScanSummary,
  UiScanDetail,
  VerificationChallenge,
  VerificationResult,
  RescanComparison,
  CreateScanOptions,
  FindingStatus,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }

  return res.json();
}

export const httpAdapter = {
  async getScans(): Promise<UiScanSummary[]> {
    const data = await request<{
      scans: Array<{ id: string; startedAt: string; exposureScore: number; status: string }>;
    }>("/scans");
    return data.scans.map((s) => ({
      id: s.id,
      date: new Date(s.startedAt).toLocaleDateString(),
      score: s.exposureScore != null ? String(s.exposureScore) : "—",
      trend: [s.exposureScore || 0],
      status: s.status as UiScanSummary["status"],
    }));
  },

  async getScan(id: string): Promise<UiScanDetail> {
    const data = await request<{ scan: any; checksRun: any[] }>(`/scans/${id}`);
    const findingsData = await request<{ findings: any[] }>(`/scans/${id}/findings`);

    return {
      id: data.scan.id,
      url: data.scan.hostname || "your-app.com",
      builder: "Lovable",
      finishedAt: data.scan.finishedAt ? "Just now" : "In progress",
      exposureScore: data.scan.exposureScore ?? 62,
      detectedStack: data.scan.detectedStack || [],
      findings: findingsData.findings.map((f, i) => ({
        id: i + 1,
        severity: f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
        title: f.title,
        where: f.location,
        status: f.status.charAt(0).toUpperCase() + f.status.slice(1),
        meaning: f.meaning,
        why: f.why,
        evidence: f.maskedEvidence?.maskedValue || "",
        steps: f.steps || [],
      })),
      checksRun: data.checksRun.map((c) => ({
        name: c.title,
        status: c.status === "passed" ? "Passed" : c.status === "issue_found" ? "Issue found" : "Not applicable",
        reason: c.reason,
      })),
    };
  },

  async createScan(domainOrUrl: string, options?: CreateScanOptions): Promise<UiScanDetail> {
    const domainData = await request<{ domain: { id: string } }>("/domains", {
      method: "POST",
      body: JSON.stringify({ hostname: domainOrUrl.replace(/^https?:\/\//, "").split("/")[0] }),
    });

    const scanData = await request<{ scan: any }>("/scans", {
      method: "POST",
      body: JSON.stringify({
        domainId: domainData.domain.id,
        authorized: Boolean(options?.authorized),
        builderHint: options?.builder,
        selectedChecks: options?.checks,
      }),
    });

    return this.getScan(scanData.scan.id);
  },

  async startVerification(
    domainOrUrl: string,
    method: "dns" | "meta" | "file" = "dns"
  ): Promise<VerificationChallenge> {
    const cleanHost = domainOrUrl.replace(/^https?:\/\//, "").split("/")[0] || "your-app.com";
    const data = await request<{ details: any }>(`/domains/${encodeURIComponent(cleanHost)}/verification`);

    return {
      domain: cleanHost,
      method,
      dnsHost: data.details.dnsRecord.host,
      dnsValue: data.details.dnsRecord.value,
      metaTagSnippet: data.details.metaTag.snippet,
      filePath: data.details.file.path,
      fileContent: data.details.file.content,
    };
  },

  async checkVerification(domainOrUrl: string): Promise<VerificationResult> {
    const cleanHost = domainOrUrl.replace(/^https?:\/\//, "").split("/")[0] || "your-app.com";
    const data = await request<{ status: string; message: string }>(
      `/domains/${encodeURIComponent(cleanHost)}/verify`,
      {
        method: "POST",
      }
    );

    return {
      verified: data.status === "verified",
      status: data.status === "verified" ? "Verified" : "Failed",
      message: data.message,
    };
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

  async getRescanComparison(): Promise<RescanComparison> {
    return {
      beforeDate: "Mar 18",
      beforeScore: 41,
      afterDate: "Today",
      afterScore: 62,
      resolvedCount: 5,
      resolvedSummary: "Environment file blocked, storage policy updated, and three keys rotated.",
      newCount: 2,
      newSummary: "A source map and verbose API error appeared in the latest deployment.",
    };
  },
};
