import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { domainsRouter } from "./routes/domains";
import { scansRouter } from "./routes/scans";
import { findingsRouter } from "./routes/findings";
import { requireAuth } from "./middleware/auth";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Public routes
  app.use(healthRouter);

  // Authenticated routes
  app.use(requireAuth);
  app.use(domainsRouter);
  app.use(scansRouter);
  app.use(findingsRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Route not found" });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
