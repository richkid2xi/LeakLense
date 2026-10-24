export type Severity = "Critical" | "High" | "Medium" | "Low";
export type FindingStatus = "Open" | "Fixed" | "Ignored";

export interface UiFinding {
  id: number;
  severity: Severity;
  title: string;
  where: string;
  status: FindingStatus;
  meaning: string;
  why: string;
  evidence: string;
  steps: string[];
}

export type CheckRunStatus = "Passed" | "Issue found" | "Not applicable" | "Couldn't test";

export interface UiCheckRun {
  name: string;
  status: CheckRunStatus;
  reason?: string;
}

export interface UiScanSummary {
  id: string;
  date: string;
  score: string;
  trend: number[];
  status: "complete" | "failed" | "running";
}

export interface UiScanDetail {
  id: string;
  url: string;
  builder: string;
  finishedAt: string;
  exposureScore: number;
  detectedStack: string[];
  findings: UiFinding[];
  checksRun: UiCheckRun[];
}

export interface VerificationChallenge {
  domain: string;
  method: "dns" | "meta" | "file";
  dnsHost: string;
  dnsValue: string;
  metaTagSnippet: string;
  filePath: string;
  fileContent: string;
}

export interface VerificationResult {
  verified: boolean;
  status: "Waiting" | "Checking" | "Verified" | "Failed";
  message?: string;
}

export interface RescanComparison {
  beforeDate: string;
  beforeScore: number;
  afterDate: string;
  afterScore: number;
  resolvedCount: number;
  resolvedSummary: string;
  newCount: number;
  newSummary: string;
}

export interface CreateScanOptions {
  builder?: string;
  checks?: string[];
  authorized: boolean;
}
