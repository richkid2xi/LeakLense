import { KbEntry } from "../schema";

export const LL_SUPA_001: KbEntry = {
  id: "LL-SUPA-001",
  title: "Supabase table readable by anonymous users without RLS",
  category: "Database",
  defaultSeverity: "high",
  plainEnglishExplanation:
    "A table in your Supabase database does not have Row Level Security (RLS) enabled or has an overly permissive SELECT policy. Any internet user can query rows directly using your public publishable key.",
  realisticConsequence:
    "Anyone who inspects your app's public Supabase URL and anon key can fetch the contents of this table via the REST API. If the table holds user emails, addresses, orders, or private records, that data is publicly exposed.",
  howItHappensInAiApps:
    "AI coding agents frequently generate SQL migration scripts to create tables (e.g. `CREATE TABLE profiles (...)`) but skip `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` or create a blanket `FOR SELECT USING (true)` policy so that data fetching 'just works' during the prompt generation session.",
  severityLogic:
    "High. While the anon key is intended to be public, tables without RLS permit unrestricted data extraction by any visitor.",
  fixSteps: [
    "Open the Supabase dashboard and navigate to Authentication > Policies or Database > Tables.",
    "Select the affected table and toggle 'Enable Row Level Security' (RLS).",
    "Add a restrictive SELECT policy (e.g., `auth.uid() = user_id`) so users can only read their own rows, or require authentication.",
    "Verify using an unauthenticated curl or browser request to confirm requests receive a 401/403 or empty array.",
  ],
  preventionChecklist: [
    "Always enable RLS immediately after creating any new table in Supabase.",
    "Never create blanket `true` policies for SELECT, INSERT, UPDATE, or DELETE on tables with user data.",
    "Use Supabase Security Advisor in the dashboard before every production deployment.",
  ],
  fixPromptTemplates: {
    lovable:
      "Update this Lovable app's Supabase database configuration for table '{{tableName}}'. Instructions: (1) Enable Row Level Security (RLS) on the table: `ALTER TABLE {{tableName}} ENABLE ROW LEVEL SECURITY;`. (2) Add a secure SELECT policy restricting queries to authenticated users who own the record (`auth.uid() = user_id`). (3) If public read access is required, restrict returned columns to non-sensitive fields. (4) Show the migration SQL and updated client code.",
    bolt: "In this Bolt project, secure Supabase table '{{tableName}}'. Instructions: (1) Write SQL migration to enable RLS: `ALTER TABLE {{tableName}} ENABLE ROW LEVEL SECURITY;`. (2) Add appropriate row-level policies for SELECT, INSERT, and UPDATE matching authenticated user IDs. (3) Verify client queries continue to function for logged-in users. (4) Summarize the changes and show the diff.",
    cursor:
      "In this Cursor workspace, fix the open Supabase table '{{tableName}}'. Steps: (1) Enable RLS on '{{tableName}}'. (2) Define granular policies for SELECT limited to the owner (`auth.uid() = user_id`) or admin roles. (3) Ensure no unauthenticated user can dump all rows via the Supabase client. (4) Preserve existing application functionality, display the diff, and explain the changes.",
    v0: "In this v0 app, configure proper security for Supabase table '{{tableName}}'. (1) Enable RLS: `ALTER TABLE {{tableName}} ENABLE ROW LEVEL SECURITY;`. (2) Add authenticated policies scoped to `auth.uid()`. (3) Verify queries in server actions or route handlers pass appropriate user context. (4) Show the diff and summarize the SQL migration.",
    any_agent:
      "Remediate open access to Supabase table '{{tableName}}': (1) Enable Row Level Security (RLS) on table '{{tableName}}'. (2) Create explicit policies for SELECT, INSERT, UPDATE, and DELETE restricting rows to authenticated owners. (3) Ensure anonymous public queries return empty results or 401 unauthorized. (4) Show the SQL diff and explain what changed.",
  },
};
