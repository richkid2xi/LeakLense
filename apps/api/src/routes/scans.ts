import { Router, Request, Response } from "express";
import { CreateScanInputSchema, Scan, CheckRun, Finding } from "@leaklens/shared";

export const scansRouter = Router();

/**
 * POST /scans
 * Enqueue a new scan for a verified domain.
 * Strictly requires authorized: true.
 */
scansRouter.post("/scans", async (req: Request, res: Response): Promise<void> => {
  const parseResult = CreateScanInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid scan request", details: parseResult.error.format() });
    return;
  }

  const { domainId } = parseResult.data;
  const mockScan: Scan = {
    id: "22222222-2222-2222-2222-222222222222",
    domainId,
    status: "running",
    startedAt: new Date(),
    detectedStack: ["Supabase", "Vite", "Vercel"],
    exposureScore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  res.status(202).json({
    scan: mockScan,
    message: "Scan enqueued into worker queue",
  });
});

/**
 * GET /scans
 * List scans for the current authenticated user
 */
scansRouter.get("/scans", async (_req: Request, res: Response): Promise<void> => {
  const mockScans: Scan[] = [
    {
      id: "22222222-2222-2222-2222-222222222222",
      domainId: "11111111-1111-1111-1111-111111111111",
      status: "completed",
      startedAt: new Date(Date.now() - 3600000),
      finishedAt: new Date(Date.now() - 3500000),
      detectedStack: ["Supabase", "Vite", "Vercel"],
      exposureScore: 62,
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3500000),
    },
  ];

  res.status(200).json({ scans: mockScans });
});

/**
 * GET /scans/:id
 * Retrieve details for a specific scan
 */
scansRouter.get("/scans/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);

  const mockScan: Scan = {
    id: id || "22222222-2222-2222-2222-222222222222",
    domainId: "11111111-1111-1111-1111-111111111111",
    status: "completed",
    startedAt: new Date(Date.now() - 3600000),
    finishedAt: new Date(Date.now() - 3500000),
    detectedStack: ["Supabase", "Vite", "Vercel"],
    exposureScore: 62,
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 3500000),
  };

  const mockCheckRuns: CheckRun[] = [
    {
      id: "c1",
      scanId: mockScan.id,
      checkId: "LL-CHECK-KEYS",
      title: "Public JavaScript secrets",
      status: "issue_found",
      createdAt: new Date(),
    },
    {
      id: "c2",
      scanId: mockScan.id,
      checkId: "LL-CHECK-SUPA-ANON",
      title: "Supabase anonymous access",
      status: "issue_found",
      createdAt: new Date(),
    },
    {
      id: "c3",
      scanId: mockScan.id,
      checkId: "LL-CHECK-SUPA-RLS",
      title: "Row-level security",
      status: "issue_found",
      createdAt: new Date(),
    },
    {
      id: "c4",
      scanId: mockScan.id,
      checkId: "LL-CHECK-STORAGE",
      title: "Public storage buckets",
      status: "issue_found",
      createdAt: new Date(),
    },
    {
      id: "c5",
      scanId: mockScan.id,
      checkId: "LL-CHECK-SENSITIVE-FILES",
      title: "Reachable sensitive files",
      status: "passed",
      createdAt: new Date(),
    },
    {
      id: "c6",
      scanId: mockScan.id,
      checkId: "LL-CHECK-FIREBASE",
      title: "Firebase database rules",
      status: "not_applicable",
      reason: "Firebase not detected",
      createdAt: new Date(),
    },
    {
      id: "c7",
      scanId: mockScan.id,
      checkId: "LL-CHECK-CORS",
      title: "CORS configuration",
      status: "could_not_test",
      reason: "API did not return CORS headers",
      createdAt: new Date(),
    },
  ];

  res.status(200).json({
    scan: mockScan,
    checksRun: mockCheckRuns,
  });
});

/**
 * GET /scans/:id/findings
 * List findings identified in a scan
 */
scansRouter.get("/scans/:id/findings", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);

  const mockFindings: Finding[] = [
    {
      id: "33333333-3333-3333-3333-333333333301",
      scanId: id || "22222222-2222-2222-2222-222222222222",
      type: "LL-KEY-001",
      severity: "critical",
      status: "open",
      location: "/assets/index-a81c.js",
      title: "Live secret key exposed in main bundle",
      meaning: "A private service key was included in code sent to every visitor's browser.",
      why: "Someone could copy it and use the connected service as if they were you.",
      maskedEvidence: {
        kind: "key",
        maskedValue: "sk_live_••••••••••••8f2a",
        location: "/assets/index-a81c.js",
      },
      metadata: {},
      steps: [
        "Rotate the exposed key in the service dashboard.",
        "Move the replacement key to a server-side environment variable.",
        "Remove the key from client code and redeploy.",
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "33333333-3333-3333-3333-333333333302",
      scanId: id || "22222222-2222-2222-2222-222222222222",
      type: "LL-SUPA-001",
      severity: "high",
      status: "open",
      location: "supabase/public/profiles",
      title: "Table 'profiles' readable by anonymous users",
      meaning: "Anyone can query every row in the profiles table without signing in.",
      why: "Private profile information may be visible outside your app.",
      maskedEvidence: {
        kind: "table",
        maskedValue: "GET /rest/v1/profiles → 200 anon",
        location: "supabase/public/profiles",
      },
      metadata: {},
      steps: [
        "Enable row-level security on profiles.",
        "Add a SELECT policy limited to the signed-in user.",
        "Test the table with an anonymous request.",
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  res.status(200).json({ findings: mockFindings });
});
