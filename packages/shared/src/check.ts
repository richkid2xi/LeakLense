import { z } from "zod";

export const CheckStatusSchema = z.enum(["passed", "issue_found", "not_applicable", "could_not_test"]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const CheckResultSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  checkId: z.string().optional(),
  title: z.string().optional(),
  status: CheckStatusSchema,
  reason: z.string().optional(),
});

export type CheckResult = z.infer<typeof CheckResultSchema>;

export const CheckRunSchema = z.object({
  id: z.string().uuid(),
  scanId: z.string().uuid(),
  checkId: z.string(),
  title: z.string(),
  status: CheckStatusSchema,
  reason: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});

export type CheckRun = z.infer<typeof CheckRunSchema>;

export const PLANNED_CHECKS = [
  {
    id: "LL-CHECK-KEYS",
    title: "Secret and API keys exposed in public JavaScript",
    category: "Secrets",
  },
  {
    id: "LL-CHECK-SUPA-ANON",
    title: "Supabase tables readable without login",
    category: "Database",
  },
  {
    id: "LL-CHECK-SUPA-RLS",
    title: "Missing row-level security on Supabase tables",
    category: "Database",
  },
  {
    id: "LL-CHECK-STORAGE",
    title: "Public storage buckets",
    category: "Storage",
  },
  {
    id: "LL-CHECK-SENSITIVE-FILES",
    title: "Reachable .env files, .git folders, source maps",
    category: "Configuration",
  },
  {
    id: "LL-CHECK-FIREBASE",
    title: "Open Firebase database rules (when Firebase is detected)",
    category: "Database",
    conditionalOn: "firebase",
  },
  {
    id: "LL-CHECK-CORS",
    title: "Overly permissive CORS settings",
    category: "Network",
  },
] as const;

export const EXPLICIT_EXCLUSIONS = [
  "Server, operating system and network vulnerabilities",
  "WordPress and other CMS plugin or theme vulnerabilities",
  "Malware or hacked-site cleanup",
  "Logic flaws in your app's own code or business rules",
  "Anything behind a login",
  "Private repositories and source code review",
  "Third-party services you connect to",
  "Denial-of-service and performance attacks",
] as const;
