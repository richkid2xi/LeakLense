import {
  UiFinding,
  UiCheckRun,
  UiScanSummary,
  UiScanDetail,
  VerificationChallenge,
  VerificationResult,
  RescanComparison,
  CreateScanOptions,
  FindingStatus,
} from "./types";

export const initialMockFindings: UiFinding[] = [
  {
    id: 1,
    severity: "Critical",
    title: "Live secret key exposed in main bundle",
    where: "/assets/index-a81c.js",
    status: "Open",
    meaning: "A private service key was included in code sent to every visitor’s browser.",
    why: "Someone could copy it and use the connected service as if they were you.",
    evidence: "sk_live_••••••••••••8f2a",
    steps: [
      "Rotate the exposed key in the service dashboard.",
      "Move the replacement key to a server-side environment variable.",
      "Remove the key from client code and redeploy.",
    ],
  },
  {
    id: 2,
    severity: "High",
    title: "Table “profiles” readable by anonymous users",
    where: "supabase/public/profiles",
    status: "Open",
    meaning: "Anyone can query every row in the profiles table without signing in.",
    why: "Private profile information may be visible outside your app.",
    evidence: "GET /rest/v1/profiles → 200 anon",
    steps: [
      "Enable row-level security on profiles.",
      "Add a SELECT policy limited to the signed-in user.",
      "Test the table with an anonymous request.",
    ],
  },
  {
    id: 3,
    severity: "High",
    title: "Public storage bucket “uploads”",
    where: "storage/uploads",
    status: "Open",
    meaning: "Files in uploads can be listed and downloaded without authentication.",
    why: "User uploads may be discoverable by anyone who knows the bucket name.",
    evidence: "bucket: uploads / public: true",
    steps: [
      "Set the uploads bucket to private.",
      "Add a policy for file owners.",
      "Use signed URLs when displaying files.",
    ],
  },
  {
    id: 4,
    severity: "Critical",
    title: "Environment file is publicly reachable",
    where: "/.env",
    status: "Fixed",
    meaning: "Your deployed server returns the environment file over the public web.",
    why: "Environment files often contain credentials that unlock other services.",
    evidence: "GET /.env → 200 / KEY=••••",
    steps: [
      "Block dotfiles at the web server.",
      "Remove .env from the deployment output.",
      "Rotate every secret that was present.",
    ],
  },
  {
    id: 5,
    severity: "High",
    title: "Row-level security missing on “orders”",
    where: "supabase/public/orders",
    status: "Open",
    meaning: "The orders table does not enforce per-user access rules.",
    why: "A client with the public key may read or change other customers’ orders.",
    evidence: "orders.relrowsecurity = false",
    steps: [
      "Enable row-level security on orders.",
      "Add policies for SELECT, INSERT and UPDATE.",
      "Confirm anonymous requests are denied.",
    ],
  },
  {
    id: 6,
    severity: "Medium",
    title: "Service URL reveals internal project ID",
    where: "/src/lib/supabase.ts",
    status: "Ignored",
    meaning: "Your public bundle exposes the project identifier used by your database client.",
    why: "It gives an attacker useful context when combined with another configuration mistake.",
    evidence: "https://•••••.supabase.co",
    steps: [
      "Review whether this identifier is expected to be public.",
      "Remove debug configuration from the production bundle.",
      "Rescan after deploying.",
    ],
  },
  {
    id: 7,
    severity: "Medium",
    title: "Source map available in production",
    where: "/assets/index.js.map",
    status: "Open",
    meaning: "The browser can download a map of your original source files.",
    why: "Readable source makes exposed keys and application logic easier to locate.",
    evidence: "GET /assets/index.js.map → 200",
    steps: ["Disable production source maps.", "Delete existing .map files from hosting.", "Redeploy the app."],
  },
  {
    id: 8,
    severity: "Low",
    title: "Verbose API error response",
    where: "/api/profile",
    status: "Open",
    meaning: "An API response includes implementation details intended for developers.",
    why: "Detailed errors make it easier to understand your internal setup.",
    evidence: "error: relation public.profiles",
    steps: [
      "Return a generic error to the client.",
      "Keep detailed errors in server logs only.",
      "Test the production response.",
    ],
  },
  {
    id: 9,
    severity: "Low",
    title: "Storage path can be enumerated",
    where: "storage/avatars",
    status: "Fixed",
    meaning: "Predictable avatar paths reveal whether a file exists.",
    why: "This can disclose which users have uploaded an avatar.",
    evidence: "/avatars/user_••••.png",
    steps: ["Use unguessable object names.", "Require signed URLs.", "Return the same response for missing objects."],
  },
];

export const initialMockChecksRun: UiCheckRun[] = [
  { name: "Public JavaScript secrets", status: "Issue found" },
  { name: "Supabase anonymous access", status: "Issue found" },
  { name: "Row-level security", status: "Issue found" },
  { name: "Public storage buckets", status: "Issue found" },
  { name: "Reachable sensitive files", status: "Passed" },
  { name: "Firebase database rules", status: "Not applicable", reason: "Firebase not detected" },
  { name: "CORS configuration", status: "Couldn't test", reason: "API did not return CORS headers" },
];

export const initialMockScans: UiScanSummary[] = [
  { id: "LL-2025-031", date: "Today, 10:42", score: "62", trend: [40, 48, 55, 62], status: "complete" },
  { id: "LL-2025-024", date: "Mar 18, 16:08", score: "41", trend: [32, 38, 41], status: "complete" },
  { id: "LL-2025-018", date: "Mar 12, 09:21", score: "—", trend: [0], status: "failed" },
];

// In-memory mock state store
let findingsStore: UiFinding[] = [...initialMockFindings];
let scansStore: UiScanSummary[] = [...initialMockScans];

export const mockAdapter = {
  async getScans(): Promise<UiScanSummary[]> {
    return [...scansStore];
  },

  async getScan(id: string): Promise<UiScanDetail> {
    const fixedCount = findingsStore.filter((f) => f.status === "Fixed").length;
    const score = 62 + Math.max(0, fixedCount - 2) * 4;

    return {
      id: id || "LL-2025-031",
      url: "acme-notes.app",
      builder: "Lovable",
      finishedAt: "Just now",
      exposureScore: score,
      detectedStack: ["Supabase", "Vite", "Vercel"],
      findings: [...findingsStore],
      checksRun: [...initialMockChecksRun],
    };
  },

  async createScan(domainOrUrl: string, options?: CreateScanOptions): Promise<UiScanDetail> {
    const newId = `LL-${new Date().getFullYear()}-${String(scansStore.length + 32).padStart(3, "0")}`;
    const newScan: UiScanSummary = {
      id: newId,
      date: "Just now",
      score: "62",
      trend: [50, 58, 62],
      status: "complete",
    };
    scansStore.unshift(newScan);

    return {
      id: newId,
      url: domainOrUrl.replace(/^https?:\/\//, ""),
      builder: options?.builder || "Lovable",
      finishedAt: "Just now",
      exposureScore: 62,
      detectedStack: ["Supabase", "Vite", "Vercel"],
      findings: [...findingsStore],
      checksRun: [...initialMockChecksRun],
    };
  },

  async startVerification(
    domainOrUrl: string,
    method: "dns" | "meta" | "file" = "dns"
  ): Promise<VerificationChallenge> {
    const cleanHost = domainOrUrl.replace(/^https?:\/\//, "").split("/")[0] || "your-app.com";
    return {
      domain: cleanHost,
      method,
      dnsHost: "_leaklens",
      dnsValue: "leaklens-verification=ll_sample_3a82",
      metaTagSnippet: '<meta name="leaklens-verification" content="ll_sample_3a82" />',
      filePath: "/.well-known/leaklens.txt",
      fileContent: "leaklens-verification=ll_sample_3a82",
    };
  },

  async checkVerification(domainOrUrl: string): Promise<VerificationResult> {
    return {
      verified: true,
      status: "Verified",
      message: `Domain ${domainOrUrl} verified successfully`,
    };
  },

  async getFindingDetail(id: string | number): Promise<UiFinding | undefined> {
    const numId = Number(id);
    return findingsStore.find((f) => f.id === numId);
  },

  async markFindingStatus(id: string | number, status: FindingStatus): Promise<UiFinding> {
    const numId = Number(id);
    const item = findingsStore.find((f) => f.id === numId);
    if (!item) {
      throw new Error(`Finding with id ${id} not found`);
    }
    item.status = status;
    return { ...item };
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

  resetStore() {
    findingsStore = [...initialMockFindings];
    scansStore = [...initialMockScans];
  },
};
