export interface SampleCheckItem {
  id: string;
  number: string;
  name: string;
  resultStatus: "issue" | "passed";
  resultLabel: "Issue found" | "Passed";
  severity?: "High" | "Medium";
  explanation: string;
  maskedEvidence: string;
  fixPrompt: string | null;
}

export interface HeroScanContent {
  microLabel: string;
  hostname: string;
  disclaimer: string;
  replayButtonLabel: string;
  summaryTemplate: (checksCount: number, issuesCount: number) => string;
  checks: SampleCheckItem[];
}

export const HERO_SCAN_CONTENT: HeroScanContent = {
  microLabel: "SAMPLE SCAN",
  hostname: "acme-notes.app",
  disclaimer: "Sample data. Not a real site.",
  replayButtonLabel: "Replay",
  summaryTemplate: (checksCount, issuesCount) =>
    `${checksCount} checks run · ${issuesCount} ${issuesCount === 1 ? "issue" : "issues"} found`,
  checks: [
    {
      id: "keys",
      number: "01",
      name: "Keys in your JavaScript",
      resultStatus: "issue",
      resultLabel: "Issue found",
      severity: "High",
      explanation:
        "A private API key embedded in client bundle files allows visitors to bypass intended access rules.",
      maskedEvidence:
        "const serviceKey = \"sk_live_51...•••••9xQ4\"; // found in /assets/index-b42e.js",
      fixPrompt:
        "Rotate the exposed secret key in your dashboard first to invalidate it. Then remove all secret keys from client-side bundles and access the service through an authenticated server-side endpoint.",
    },
    {
      id: "database",
      number: "02",
      name: "Open database tables",
      resultStatus: "issue",
      resultLabel: "Issue found",
      severity: "High",
      explanation:
        "Database tables allow unauthenticated read requests because row-level security is not enabled.",
      maskedEvidence:
        "GET /rest/v1/user_notes?select=* -> HTTP 200 (12 user records returned publicly)",
      fixPrompt:
        "Enable row-level security on the user_notes table and define policies that restrict read access to authenticated user IDs only.",
    },
    {
      id: "storage",
      number: "03",
      name: "Public storage",
      resultStatus: "passed",
      resultLabel: "Passed",
      explanation:
        "Storage buckets reject anonymous listing requests and require signed tokens for access.",
      maskedEvidence:
        "GET /storage/v1/s3/user-data/ -> HTTP 403 Forbidden",
      fixPrompt: null,
    },
    {
      id: "config",
      number: "04",
      name: "Exposed config files",
      resultStatus: "passed",
      resultLabel: "Passed",
      explanation:
        "Server edge routing properly blocks requests to environment files and version control metadata.",
      maskedEvidence:
        "GET /.env.production -> HTTP 404 Not Found",
      fixPrompt: null,
    },
  ],
};
