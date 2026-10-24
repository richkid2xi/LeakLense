import { mockAdapter, initialMockFindings, initialMockChecksRun, initialMockScans } from "./mockAdapter";
import { httpAdapter } from "./httpAdapter";
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

export * from "./types";
export { initialMockFindings, initialMockChecksRun, initialMockScans };

// Flag controlling mock mode vs real API mode
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const adapter = USE_MOCK ? mockAdapter : httpAdapter;

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

export async function checkVerification(domainOrUrl: string): Promise<VerificationResult> {
  return adapter.checkVerification(domainOrUrl);
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

export async function getRescanComparison(): Promise<RescanComparison> {
  return adapter.getRescanComparison();
}
