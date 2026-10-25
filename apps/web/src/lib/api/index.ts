import { mockAdapter, initialMockFindings, initialMockChecksRun, initialMockScans } from "./mockAdapter";
import { httpAdapter } from "./httpAdapter";
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

export * from "./types";
export { initialMockFindings, initialMockChecksRun, initialMockScans };

// Flag controlling mock mode vs real API mode
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

const adapter = USE_MOCK ? mockAdapter : httpAdapter;

export async function getDomains(): Promise<UiDomain[]> {
  return adapter.getDomains();
}

export async function deleteDomain(id: string): Promise<boolean> {
  return (adapter as any).deleteDomain ? (adapter as any).deleteDomain(id) : httpAdapter.deleteDomain(id);
}

export async function getScans(): Promise<UiScanSummary[]> {
  return adapter.getScans();
}

export async function getScan(id: string): Promise<UiScanDetail> {
  return adapter.getScan(id);
}

export async function createScan(domainOrUrl: string, options?: CreateScanOptions): Promise<UiScanDetail> {
  return adapter.createScan(domainOrUrl, options);
}

export async function startVerification(
  domainOrUrl: string,
  method: "dns" | "meta" | "file" = "dns"
): Promise<VerificationChallenge> {
  return adapter.startVerification(domainOrUrl, method);
}

export async function checkVerification(
  domainOrUrl: string,
  method: "dns" | "meta" | "file" | "auto" = "auto"
): Promise<VerificationResult> {
  return adapter.checkVerification(domainOrUrl, method);
}

export async function getFindingDetail(id: string | number, _builder?: string): Promise<UiFinding | undefined> {
  return adapter.getFindingDetail(id);
}

export async function markFindingStatus(id: string | number, status: FindingStatus): Promise<UiFinding> {
  return adapter.markFindingStatus(id, status);
}

export async function rescan(domainOrUrl: string): Promise<UiScanDetail> {
  return adapter.rescan(domainOrUrl);
}

export async function getRescanComparison(scanId?: string): Promise<RescanComparison> {
  return adapter.getRescanComparison(scanId);
}

export async function getDomainScans(domainId: string): Promise<DomainScanItem[]> {
  return (adapter as any).getDomainScans ? (adapter as any).getDomainScans(domainId) : httpAdapter.getDomainScans(domainId);
}

export async function compareScans(beforeId: string, afterId: string): Promise<CompareScansResponse> {
  return (adapter as any).compareScans ? (adapter as any).compareScans(beforeId, afterId) : httpAdapter.compareScans(beforeId, afterId);
}

export async function getPublicStats(): Promise<{ userCount: number; scanCount: number }> {
  return httpAdapter.getPublicStats();
}
