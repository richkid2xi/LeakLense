# LeakLens

LeakLens is a passive security scanner designed for websites and web applications built with AI builders (such as Lovable, Bolt, Cursor, and v0) as well as any other website the user owns. It detects a specific, curated set of public exposures—including exposed API keys, open Supabase tables, misconfigured Row Level Security (RLS), public storage buckets, and reachable `.env`, `.git`, or source map files—and translates each finding into plain-English explanations with realistic consequences, manual remediation steps, and safe, parameterized prompts for AI coding agents. LeakLens is strictly an educational prevention tool and is not a full security audit, penetration test, or compliance certification.

## Repository Structure

```
.
├── apps/
│   ├── web/        React 19 single-page application with Tailwind CSS v4 and mock/HTTP data adapters
│   ├── api/        Express REST API service with Prisma ORM client, verification modules, and audit logging
│   └── worker/     Background scan execution pipeline powered by pg-boss
└── packages/
    ├── shared/     Browser-safe domain types, canonical finding schemas, and Zod validation
    ├── security/   SSRF guard, IP-pinned Undici HTTP client, scope lock, and secret masking
    ├── detectors/  Modular security detectors (secrets, CORS, sensitive files, honest Phase 1 stubs)
    └── kb/         Curated knowledge base entries, schema definitions, and AI fix prompt generator
```

## Tech Stack & Architecture

- **Frontend (`apps/web`)**: React 19, Vite 8, TypeScript, Tailwind CSS v4. Operates in mock mode (`VITE_USE_MOCK=true`) or connects to the Express API (`VITE_USE_MOCK=false`).
- **Backend API (`apps/api`)**: Node.js, Express, Prisma ORM, Supabase Postgres. Implements domain ownership verification (DNS TXT, well-known file, meta tag), 30-day verification expiry, rate limiting per account/IP/domain, and immutable audit logging.
- **Worker Service (`apps/worker`)**: Node.js, pg-boss job queue. Re-validates domain verification before every scan, executes the detection pipeline, and persists check runs and findings.
- **Security Utilities (`packages/security`)**: SSRF guard blocking RFC 1918, CGNAT, loopback, cloud metadata (169.254.169.254), IPv4-mapped IPv6, decimal/octal/hex IP tricks, and userinfo injection. Pinned-IP Undici dispatcher prevents DNS rebinding TOCTOU attacks. Sets standard `LeakLensScanner/1.0 (+https://leaklens.com/about-scanner)` User-Agent.
- **Detectors (`packages/detectors`)**: Pluggable detector modules taking a context abstraction (`fetchText`, `verifiedHostname`, `target`). Detects exposed OpenAI, Stripe secret, GitHub, AWS, and private keys while explicitly ignoring public publishable keys (`pk_`, Supabase anon, Firebase web key). Evaluates permissive CORS and checks reachable `.env` (extracts variable names only; never stores secrets) and `.git` folders.
- **Knowledge Base & Prompts (`packages/kb`)**: Generates structured, copy-pasteable fix prompts tailored for Lovable, Bolt, Cursor, v0, or generic AI coding agents.

## Verification & Trust Model

1. **Public Suffix Rejection**: Multi-tenant platform root domains (`vercel.app`, `netlify.app`, `github.io`, `lovable.app`, `pages.dev`, `firebaseapp.com`, `railway.app`, `fly.dev`, etc.) cannot be verified at the apex level. Users must verify their specific subdomain (e.g. `your-app.lovable.app`) or custom domain.
2. **30-Day Verification Expiry**: Verification challenges and domain ownership expire after 30 days. Domain status is re-checked prior to every scan. Scans cannot be initiated on unverified or expired domains.
3. **Email Verification**: User accounts must have verified email addresses before initiating scans.
4. **Ownership Affirmation**: Users must explicitly confirm site ownership/authorization (`authorized: true`) before queueing a scan; affirmations are immutably recorded in the security audit log.
5. **Coverage Honesty**: The scanner never produces fake passes. For Phase 1 TODOs (Supabase open tables/RLS, storage buckets, Firebase rules), the pipeline reports `could_not_test` or `not_applicable`. On response truncation or timeout, checks report `could_not_test` with reasons, never `passed`.

## Prerequisites and Setup

### Prerequisites

- Node.js (version 20 or later, version 22 recommended)
- pnpm (version 10 or later)
- PostgreSQL database instance (optional for UI mock development; required for running Prisma migrations and worker queue)

### Installation

```bash
git clone <repository-url>
cd LeakLens
pnpm install
```

### Environment Configuration

Template environment files are provided for the repository root and each application:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

By default, `apps/web` has `VITE_USE_MOCK=true`, allowing full UI navigation and prototype testing without running backend services or databases.

### Database Setup

When connecting to a live PostgreSQL database:

```bash
# Generate the Prisma client for @leaklens/api
pnpm --filter @leaklens/api prisma:generate

# Apply database schema migrations
pnpm --filter @leaklens/api prisma migrate dev
```

### Running Services

```bash
# Run web application in development mode (port 8443)
pnpm dev

# Run API server in watch mode (port 3001)
pnpm dev:api

# Run worker process in watch mode
pnpm dev:worker

# Run web, API, and worker concurrently
pnpm dev:all
```

## Running Tests

All automated tests use fixtures only (no live network connections):

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for specific packages
pnpm --filter @leaklens/security test
pnpm --filter @leaklens/detectors test
pnpm --filter @leaklens/api test
pnpm --filter @leaklens/worker test
pnpm --filter @leaklens/kb test
```

## Root Scripts

| Script              | Description                                                                     |
| :------------------ | :------------------------------------------------------------------------------ |
| `pnpm dev`          | Starts the web application development server with hot module replacement       |
| `pnpm dev:api`      | Starts the Express API server with tsx in watch mode                            |
| `pnpm dev:worker`   | Starts the background worker engine with tsx in watch mode                      |
| `pnpm dev:all`      | Runs web, API, and worker concurrently in parallel                              |
| `pnpm build`        | Compiles and builds all workspace packages and applications recursively         |
| `pnpm typecheck`    | Runs TypeScript type checking across all workspace packages with strict options |
| `pnpm test`         | Executes all Vitest unit and integration tests across the monorepo              |
| `pnpm lint`         | Lints JavaScript and TypeScript source files using ESLint                       |
| `pnpm format`       | Formats all code files using Prettier                                           |
| `pnpm format:check` | Verifies code formatting against Prettier rules without writing changes         |
