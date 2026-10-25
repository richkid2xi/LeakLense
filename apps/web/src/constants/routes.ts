export type ScreenId =
  | "new"
  | "verify"
  | "progress"
  | "results"
  | "history"
  | "apps"
  | "compare"
  | "settings"
  | "failed";

/**
 * Canonical route-to-label map used by both mobile and desktop breadcrumbs
 * to ensure directory paths stay strictly in sync.
 * /scans -> "Scans", a scan result -> "Report", /apps -> "Apps",
 * /settings -> "Settings", new scan -> "New scan", compare rescans -> "Compare".
 */
export const ROUTE_DIRECTORY_LABELS: Record<string, string> = {
  history: "Scans",
  scans: "Scans",
  results: "Report",
  report: "Report",
  apps: "Apps",
  settings: "Settings",
  new: "New scan",
  compare: "Compare",
  verify: "Verification",
  progress: "Scanning",
  failed: "Report",
};

export function getDirectoryLabel(screen: string, appHost?: string | null): string {
  if (screen === "history" && appHost && appHost !== "all") {
    return `Scans / ${appHost.toUpperCase()}`;
  }
  return ROUTE_DIRECTORY_LABELS[screen] || "Overview";
}

export function getHistoryBreadcrumb(appHost?: string | null): string {
  if (appHost && appHost !== "all") {
    return `APPS / ${appHost.toUpperCase()}`;
  }
  return "APPS";
}
