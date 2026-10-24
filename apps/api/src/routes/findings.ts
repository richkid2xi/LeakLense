import { Router, Request, Response } from "express";
import { UpdateFindingStatusInputSchema, Finding, BuilderTarget } from "@leaklens/shared";
import { getKbEntry, generateFixPrompt } from "@leaklens/kb";

export const findingsRouter = Router();

/**
 * GET /findings/:id
 * Retrieve single finding with Knowledge Base enrichment and prompt generator
 */
findingsRouter.get("/findings/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const builder = (req.query.builder as BuilderTarget) || "Lovable";

  const mockFinding: Finding = {
    id: id || "33333333-3333-3333-3333-333333333301",
    scanId: "22222222-2222-2222-2222-222222222222",
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
  };

  // Enrich with KB entry if available
  const kbEntry = getKbEntry(mockFinding.type);
  let tailoredPrompt: string | undefined;

  if (kbEntry) {
    tailoredPrompt = generateFixPrompt({
      entry: kbEntry,
      builder,
      placeholders: {
        findingTitle: mockFinding.title,
        location: mockFinding.location,
        maskedKey: mockFinding.maskedEvidence.maskedValue,
        specificSteps: mockFinding.steps,
      },
    });
  }

  res.status(200).json({
    finding: mockFinding,
    kb: kbEntry,
    fixPrompt: tailoredPrompt,
  });
});

/**
 * PATCH /findings/:id/status
 * Update status of a finding (open | fixed | ignored)
 */
findingsRouter.patch("/findings/:id/status", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const parseResult = UpdateFindingStatusInputSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid status value", details: parseResult.error.format() });
    return;
  }

  const { status } = parseResult.data;

  res.status(200).json({
    id,
    status,
    updatedAt: new Date().toISOString(),
    message: `Finding status updated to ${status}. A rescan is required to confirm remediation.`,
  });
});

/**
 * POST /findings/:id/recheck
 * Re-run only the detector for this specific finding
 */
findingsRouter.post("/findings/:id/recheck", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);

  res.status(200).json({
    findingId: id,
    status: "rechecking",
    message: "Recheck job enqueued. Running isolated detector check.",
  });
});
