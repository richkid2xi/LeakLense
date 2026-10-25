import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "leaklens-api",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

healthRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const { getPrismaClient } = await import("../db");
    const prisma = getPrismaClient();
    const [userCount, scanCount] = await Promise.all([
      prisma.user.count(),
      prisma.scan.count(),
    ]);
    res.status(200).json({
      userCount,
      scanCount,
    });
  } catch (err) {
    res.status(200).json({
      userCount: 0,
      scanCount: 0,
    });
  }
});
