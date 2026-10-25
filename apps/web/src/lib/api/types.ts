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
  hostname?: string;
  date: string;
  startedAt?: string;
  finishedAt?: string;
  findingCount?: number;
  score: string;
  scoreNumber: number;
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
  status?: string;
  metrics?: {
    stage?: string;
    stepIndex?: number;
    assetsFetched?: number;
    bytesRead?: number;
    requestsMade?: number;
  };
}

export interface UiDomain {
  id: string;
  hostname: string;
  status: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  scanCount?: number;
  latestScore?: number | null;
  latestScanStatus?: string | null;
  recentScores?: number[];
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

export interface DomainScanItem {
  id: string;
  domainId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  score: number | null;
  scoreVersion: string;
  countsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  couldNotTestCount: number;
}

export interface CompareFindingItem {
  id?: number | string;
  title: string;
  severity: Severity;
  where: string;
  fingerprint?: string;
}

export interface CompareScansResponse {
  beforeScanId: string;
  afterScanId: string;
  beforeScore: number;
  afterScore: number;
  deltaScore: number;
  counts: {
    resolved: number;
    new: number;
    unchanged: number;
    notTested: number;
  };
  resolved: CompareFindingItem[];
  new: CompareFindingItem[];
  unchanged: CompareFindingItem[];
  notTested: CompareFindingItem[];
  comparison?: RescanComparison;
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
  headline?: string;
}

export interface PublicStats {
  userCount: number;
  scanCount: number;
}

export interface CreateScanOptions {
  builder?: string;
  checks?: string[];
  authorized: boolean;
}
