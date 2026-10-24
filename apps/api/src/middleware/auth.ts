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

  // Support test headers for unit tests and local dev
  const mockUserId = (req.headers["x-test-user-id"] as string) || "00000000-0000-0000-0000-000000000001";
  const mockEmailVerified = req.headers["x-test-email-verified"] !== "false";

  req.user = {
    id: mockUserId,
    email: `${mockUserId}@example.com`,
    name: "Alex Morgan",
    role: "user",
    emailVerified: mockEmailVerified,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  next();
}
