import { Request, Response, NextFunction } from "express";
import { User } from "@leaklens/shared";
import { getPrismaClient } from "../db";

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Auth Middleware
 *
 * Validates Supabase Auth JWT from Authorization header when present,
 * or falls back to test/development session in dev mode.
 * Automatically provisions the user record in Postgres via Prisma.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const supabaseUrl = process.env.SUPABASE_URL;

  let resolvedUser: User | null = null;

  // 1. If Bearer token is provided and Supabase URL is configured, verify with Supabase Auth
  if (token && supabaseUrl) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.SUPABASE_ANON_KEY || "",
        },
      });

      if (response.ok) {
        const sbUser = await response.json();
        resolvedUser = {
          id: sbUser.id,
          email: sbUser.email || `${sbUser.id}@user.leaklens.com`,
          name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || null,
          role: sbUser.app_metadata?.role || "user",
          emailVerified: Boolean(sbUser.email_confirmed_at),
          createdAt: new Date(sbUser.created_at || Date.now()),
          updatedAt: new Date(sbUser.updated_at || Date.now()),
        };
      }
    } catch (err) {
      console.warn("Failed to verify token with Supabase:", err);
    }
  }

  // 2. Reject unauthenticated requests in production
  if (!resolvedUser && process.env.NODE_ENV === "production") {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // 3. Fallback to mock session for development/testing if no valid token
  if (!resolvedUser) {
    const mockUserId = (req.headers["x-test-user-id"] as string) || "00000000-0000-0000-0000-000000000001";
    const mockEmailVerified = req.headers["x-test-email-verified"] !== "false";

    resolvedUser = {
      id: mockUserId,
      email: `${mockUserId}@example.com`,
      name: "Alex Morgan",
      role: "user",
      emailVerified: mockEmailVerified,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  req.user = resolvedUser;

  // 4. Ensure user exists in Postgres database
  try {
    const prisma = getPrismaClient();
    await prisma.user.upsert({
      where: { id: resolvedUser.id },
      create: {
        id: resolvedUser.id,
        email: resolvedUser.email,
        name: resolvedUser.name,
        role: resolvedUser.role,
      },
      update: {
        email: resolvedUser.email,
        name: resolvedUser.name,
      },
    });
  } catch (err) {
    // Non-blocking in mock/offline mode
    if (process.env.NODE_ENV === "production") {
      console.error("Failed to sync user record with Postgres:", err);
    }
  }

  next();
}
