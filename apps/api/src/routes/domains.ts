import { Router, Request, Response } from "express";
import { CreateDomainInputSchema, StartVerificationInputSchema, Domain, VerificationDetails } from "@leaklens/shared";

export const domainsRouter = Router();

/**
 * POST /domains
 * Register a new domain for verification and scanning
 */
domainsRouter.post("/domains", async (req: Request, res: Response): Promise<void> => {
  const parseResult = CreateDomainInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid hostname", details: parseResult.error.format() });
    return;
  }

  const { hostname } = parseResult.data;
  const mockDomain: Domain = {
    id: "11111111-1111-1111-1111-111111111111",
    userId: req.user?.id || "00000000-0000-0000-0000-000000000001",
    hostname,
    status: "pending_verification",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  res.status(201).json({ domain: mockDomain });
});

/**
 * GET /domains/:id/verification
 * Retrieve active verification challenge details (DNS TXT, meta tag, file token)
 */
domainsRouter.get("/domains/:id/verification", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const token = `ll_sample_3a82_${id?.slice(0, 4) || "demo"}`;

  const details: VerificationDetails = {
    method: "dns_txt",
    token,
    dnsRecord: {
      type: "TXT",
      host: "_leaklens",
      value: `leaklens-verification=${token}`,
    },
    metaTag: {
      name: "leaklens-verification",
      content: token,
      snippet: `<meta name="leaklens-verification" content="${token}" />`,
    },
    file: {
      path: "/.well-known/leaklens.txt",
      content: `leaklens-verification=${token}`,
    },
  };

  res.status(200).json({
    domainId: id,
    status: "pending",
    details,
  });
});

/**
 * POST /domains/:id/verify
 * Trigger verification check (DNS TXT, meta tag, or file)
 */
domainsRouter.post("/domains/:id/verify", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const parseResult = StartVerificationInputSchema.safeParse(req.body);
  const method = parseResult.success ? parseResult.data.method : "dns_txt";

  // In Phase 0: stub verification response
  res.status(200).json({
    domainId: id,
    method,
    status: "verified",
    verifiedAt: new Date().toISOString(),
    message: "Domain ownership verified successfully",
  });
});
