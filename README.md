# LeakLens

LeakLens is a passive security scanner designed for websites and web applications built with AI builders (such as Lovable, Bolt, Cursor, and v0) as well as any other website the user owns. It detects a specific, curated set of public exposures—including exposed API keys, open Supabase tables, misconfigured Row Level Security (RLS), public storage buckets, and reachable `.env`, `.git`, or source map files—and translates each finding into plain-English explanations with realistic consequences, manual remediation steps, and safe, parameterized prompts for AI coding agents. LeakLens is strictly an educational prevention tool and is not a full security audit, penetration test, or compliance certification.

## Repository Structure

```
.
├── apps/
│   ├── web/        React 19 single-page application with Tailwind CSS v4 and mock/HTTP data adapters
│   ├── api/        Express REST API service with Prisma ORM client and route controllers
│   └── worker/     Background scan execution service powered by pg-boss
└── packages/
    ├── shared/     Domain types, Zod validation schemas, masking utilities, and plan definitions
    └── kb/         Curated knowledge base entries, schema definitions, and fix prompt generator
```

## Tech Stack

- **Frontend (`apps/web`)**: React 19, Vite 8, TypeScript, Tailwind CSS v4
- **Backend API (`apps/api`)**: Node.js, Express, Prisma ORM, Supabase
- **Worker Service (`apps/worker`)**: Node.js, pg-boss (Postgres-backed queue)
- **Shared Libraries (`packages/shared`, `packages/kb`)**: TypeScript, Zod
- **Monorepo & Package Management**: pnpm workspaces

## Prerequisites and Setup

### Prerequisites

- Node.js (version 20 or later, version 22 recommended)
- pnpm (version 10 or later)
- PostgreSQL database instance (optional for UI mock development; required for running Prisma migrations and the worker queue)

### Installation

Clone the repository and install all workspace dependencies:

```bash
git clone <repository-url>
cd LeakLens
pnpm install
```

### Environment Configuration

Template environment files are provided for the repository root and each application. Copy the `.env.example` templates to create your local `.env` files:

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

## Root Scripts

| Script              | Description                                                                     |
| :------------------ | :------------------------------------------------------------------------------ |
| `pnpm dev`          | Starts the web application development server with hot module replacement       |
| `pnpm dev:api`      | Starts the Express API server with tsx in watch mode                            |
| `pnpm dev:worker`   | Starts the background worker engine with tsx in watch mode                      |
| `pnpm dev:all`      | Runs web, API, and worker concurrently in parallel                              |
| `pnpm build`        | Compiles and builds all workspace packages and applications recursively         |
| `pnpm typecheck`    | Runs TypeScript type checking across all workspace packages with strict options |
| `pnpm lint`         | Lints JavaScript and TypeScript source files using ESLint                       |
| `pnpm format`       | Formats all code files using Prettier                                           |
| `pnpm format:check` | Verifies code formatting against Prettier rules without writing changes         |

## Project Status

- **Implemented**: Complete web application UI prototype (landing, dashboard, scan view, finding detail modal, fix prompt modal, domain verification modal, coverage documentation, settings), data-access layer abstraction with full mock adapter (`VITE_USE_MOCK=true`) and HTTP API client, shared TypeScript domain types and Zod validation schemas, Prisma schema definitions, Express API routing skeleton, worker pg-boss queue scaffolding, curated knowledge base template generator (`packages/kb`), and automated CI workflow.
- **Not Yet Implemented**: Real scanner detector execution against live targets, Supabase Auth session validation, DNS and HTML meta tag live domain ownership verification, subscription billing webhooks and checkout sessions (Lemon Squeezy / Paddle / Paystack), and email dispatching (Resend).

## Security and Responsible Use

- **Ownership Verification**: Scans may only target domains and hosts explicitly verified as owned by the user via DNS TXT record or HTML meta tag. Scanning third-party or unverified domains is strictly prohibited.
- **Passive and Read-Only**: Scanner checks perform non-destructive, read-only requests. Probes do not execute fuzzing, write operations, authentication bypass attacks, or brute-force requests.
- **No Raw Secrets Stored**: Any detected credentials or secret keys are masked immediately at detection time (for example, `sk_live_••••••••••••4Kp2`). Raw secret values are never saved to the database, stored in logs, or returned in API payloads.
- **Prompt Injection Defense**: Remediation prompt templates only interpolate validated identifier tokens (table names, bucket names) through strict schemas; untrusted network response bodies are never interpolated into prompt outputs.

## Contributing

1. Ensure all changes adhere to TypeScript strict mode.
2. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` before committing.
3. Keep pull requests focused on small, testable increments.

## License

MIT License placeholder. See LICENSE file for terms.
