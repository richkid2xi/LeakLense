# LeakLens

> Passive security scanner for apps built with AI builders (Lovable, Bolt, Cursor, v0) and any other website you own.

LeakLens finds a specific, listed set of public exposures (leaked secret keys, open Supabase tables, missing row-level security, public storage buckets, reachable `.env`/`.git`/source maps), explains each in plain English, details realistic consequences, and provides:

1. **Technical remediation steps** for manual resolution.
2. **Ready-to-paste fix prompts** tailored for your AI builder agent (Lovable, Bolt, Cursor, v0, Any agent).

> **Important**: LeakLens is a learning and prevention tool, **not** a penetration test or full security audit. A clean scan never claims to be "secure" or "safe"; it reports: _"No issues found in the checks we ran."_

---

## Architecture Overview

LeakLens is structured as a TypeScript monorepo using **pnpm workspaces**:

```
.
├── apps/
│   ├── web/                    # React 19 + Vite 8 + Tailwind CSS v4 (Deployed on Vercel)
│   ├── api/                    # Node + Express + Prisma + Supabase Auth (Deployed on Railway)
│   └── worker/                 # Background scanner engine with pg-boss (Deployed on Railway)
├── packages/
│   ├── shared/                 # Shared domain types, Zod schemas, masking, and plan configs
│   └── kb/                     # Curated Knowledge Base entries & safe prompt templates
├── ui-export/                  # Pristine export from Figma Make prototype (preserved reference)
├── .github/workflows/          # GitHub Actions CI (lint, typecheck, build)
├── pnpm-workspace.yaml
└── README.md
```

### Core Technologies

- **Monorepo Manager**: `pnpm` workspaces
- **Frontend (`apps/web`)**: React 19, Vite 8, Tailwind CSS v4, Data-Access Layer (`src/lib/api`) with `USE_MOCK` flag
- **Backend API (`apps/api`)**: Node.js, Express, Prisma ORM, Supabase Postgres
- **Worker (`apps/worker`)**: Node.js background process, `pg-boss` queue (Postgres-backed)
- **Validation & Shared Contracts (`packages/shared`)**: Zod schemas & TypeScript types
- **Knowledge Base (`packages/kb`)**: Curated remediation logic and prompt injection-safe template generators

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+ (`npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd LeakLens

# Install all workspace dependencies
pnpm install
```

### Environment Configuration

Copy the example environment files:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

By default, `apps/web` runs in **mock mode** (`VITE_USE_MOCK=true`), requiring zero backend or database setup to test the UI prototype.

---

## Running Locally

### 1. Web Application (UI Prototype)

```bash
# Run web development server (defaults to port 8443)
pnpm dev
```

Preview panel / browser URL: `http://localhost:8443`

### 2. API Server

```bash
# Run Express API server in watch mode (port 3001)
pnpm dev:api
```

### 3. Worker Process

```bash
# Run background scanner worker in watch mode
pnpm dev:worker
```

### 4. Run All Services Concurrently

```bash
pnpm dev:all
```

---

## Verification & Quality Commands

```bash
# Typecheck all packages and applications (TypeScript strict mode)
pnpm typecheck

# Lint all files with ESLint
pnpm lint

# Format code with Prettier
pnpm format

# Verify formatting without modifying files
pnpm format:check

# Build all packages and applications
pnpm build
```

---

## Security Principles & Scanner Design

1. **Ownership Verification First**:
   - Every domain or subdomain must pass ownership verification (DNS TXT record, HTML `<meta>` tag, or `/.well-known/leaklens.txt`) before any scan can begin.
   - Verification tokens are long, random, per-account, and expire after ~30 days.
   - Separate verification per exact hostname (never wildcard or platform domains like `vercel.app`).
2. **Strict Scope Lock**:
   - The scanner talks **only** to the verified hostname; it does not follow redirects to other hosts or scan unverified subdomains.
3. **SSRF Protection**:
   - All outbound scanner requests block private (RFC 1918), loopback (`127.0.0.1`), link-local (`169.254.0.0/16`), and cloud metadata IP ranges.
   - DNS resolution is validated before and after any redirect.
   - Hard response size caps (2MB) and strict request timeouts (5s).
4. **Passive & Read-Only**:
   - No fuzzing, no brute-force, no writes, no exploit attempts.
   - Supabase/Firebase probes are limited to 1 row, capturing only column names and `readable: yes`, never user row data.
5. **No Secret Storage**:
   - Compromised secrets are masked at detection time (`sk_live_••••••••••••4Kp2`).
   - Raw secrets are never stored, logged, or returned in API responses.
6. **Prompt Injection Prevention**:
   - Generated fix prompts for AI coding agents only interpolate typed, validated identifiers (strict regex matching for table names, bucket names, and masked prefixes). Raw page responses or unvalidated payloads are never passed into fix prompts.

---

## Development Phases

- **Phase 0 (Current)**: Monorepo audit & scaffolding, data-access abstraction layer with `USE_MOCK`, shared Zod contracts, Prisma schema, API route stubs, worker queue skeleton, KB structure with sample entries, CI.
- **Phase 1**: Supabase Auth integration, real DNS/meta ownership verification, initial detectors (leaked keys, Supabase anon/RLS), live scan pipeline.
- **Phase 2**: Remaining detectors (storage, sensitive files, CORS, Firebase), single-finding recheck, scan history persistence, rescan comparison.
- **Phase 3**: Subscription billing (Lemon Squeezy / Paddle / Paystack), scheduled rescans, email alerts (Resend).
- **Phase 4**: LLM-tailored remediation prompts, branded PDF agency reports, OAuth domain verification (Vercel/Netlify/GitHub).
