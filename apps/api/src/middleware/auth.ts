import { Request, Response, NextFunction } from "express";
import { User } from "@leaklens/shared";

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Auth Middleware Placeholder
 *
 * In Phase 0 / development mode, provides a placeholder authenticated session.
 * In Phase 1, validates Supabase Auth JWT from Authorization header or session cookie.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  // Check for Authorization header (placeholder)
  const authHeader = req.headers.authorization;

  if (process.env.NODE_ENV === "production" && !authHeader) {
    _res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Placeholder authenticated user for development / scaffolding
  req.user = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "alex@example.com",
    name: "Alex Morgan",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  next();
}
