# LeakLens

> **Passive exposure detection for applications built with modern web frameworks and AI generation tools.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20strict-blue?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B%20%7C%2022%20LTS-green?style=flat-square)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](LICENSE)

LeakLens is a focused, educational security scanner that inspects public, client-facing web assets to identify exposures in deployed web applications. It is tailored for projects built with AI coding assistants (such as Lovable, Bolt.new, Cursor, and v0) as well as modern React, Vite, and Next.js applications.

Instead of generating generic compliance reports, LeakLens explains observed exposures in plain language, provides human remediation checklists, and generates parameterized prompts engineered for AI coding agents.

Rather than claiming unprovable guarantees, LeakLens relies on concrete mechanisms to reduce false alarms:

- **SPA Fallback Protection**: Validates responses returning HTTP 200 to confirm whether they are actually the target asset or merely the Single-Page Application HTML index fallback.
- **Structure Validation**: Verifies internal formatting before raising findings (for example, verifying Git internal structures or `.env` `KEY=VALUE` syntax).
- **Public-Key Allowlist**: Distinguishes between secret credentials and intentionally public identifiers (such as Stripe publishable keys, Supabase anonymous JWTs, and Firebase web API keys).

---

## Table of Contents

1. [Overview & Problem Statement](#1-overview--problem-statement)
2. [Case Study: Self-Test Validation](#2-case-study-self-test-validation)
3. [What is Checked & Pipeline Coverage](#3-what-is-checked--pipeline-coverage)
4. [Limitations & Exclusions](#4-limitations--exclusions)
5. [How the Engine Works](#5-how-the-engine-works)
   - [Verification Engine](#51-verification-engine)
   - [Network Sandbox & SSRF Isolation](#52-network-sandbox--ssrf-isolation)
   - [Detection Engine](#53-detection-engine)
   - [Scoring Algorithm](#54-scoring-algorithm)
   - [Differential Comparison & Fingerprinting](#55-differential-comparison--fingerprinting)
   - [Worker Queue & Database Connections](#56-worker-queue--database-connections)
   - [Knowledge Base & Remediation Prompts](#57-knowledge-base--remediation-prompts)
6. [Design & User Experience](#6-design--user-experience)
7. [Monorepo Architecture](#7-monorepo-architecture)
8. [Installation & Setup](#8-installation--setup)
9. [Running Tests](#9-running-tests)
10. [Security & Responsible Use](#10-security--responsible-use)
11. [Roadmap](#11-roadmap)
12. [License](#12-license)

---

## 1. Overview & Problem Statement

### Client-Side Exposures in Modern Builds

Modern web build tools and AI coding platforms accelerate feature development, but frontend bundling often leads to unintended exposure:

1. **Client-Side Secret Embedding**: Developers storing credentials in environment variables prefixed with `VITE_` or `NEXT_PUBLIC_` inadvertently bundle private tokens directly into client-side JavaScript chunks distributed to every visitor.
2. **SPA Fallback Ambiguity**: When an unconfigured single-page application server receives a request for non-existent files like `/.env`, it often responds with HTTP 200 OK serving `index.html`. Naive scanners flag these as severe leaks, while developers may overlook genuinely exposed configuration files.
3. **Overly Permissive Cross-Origin Resource Sharing (CORS)**: Rapid development configurations sometimes combine wildcard origins (`Access-Control-Allow-Origin: *`) with credential flags (`Access-Control-Allow-Credentials: true`), permitting third-party contexts to read cross-origin responses.

LeakLens acts as a passive observer of public assets, identifying these issues without executing destructive attacks.

---

## 2. Case Study: Self-Test Validation

To validate the scanner's real-world behavior, a self-test deployment was created with deliberately planted, fake exposures:

### Planted Test Conditions (All Values Fake)

- **Bundled Keys**: Five fake credentials inserted into client-side JavaScript (including fake OpenAI, Stripe secret, GitHub, AWS, and private key structures).
- **Public Git Metadata**: Exposed `.git` repository metadata files (`/.git/HEAD` and `/.git/config`).
- **Permissive CORS**: An endpoint returning `Access-Control-Allow-Origin: *` alongside `Access-Control-Allow-Credentials: true`.
- **SPA Fallback Test**: A request to `/.env` that returned HTTP 200 with `Content-Type: text/html` serving the single-page application index page.
- **Source Map Test**: A bundle ending with `//# sourceMappingURL=index.js.map` where requesting the `.map` URL returned HTTP 403 Forbidden (`text/plain`, `Cache-Control: no-store`).

### Scan Observations

1. **Identified Exposures**:
   - **Secrets Detected**: Flagged the fake credentials in client JavaScript while applying provider-specific regex patterns and entropy checks.
   - **Git Metadata Detected**: Flagged reachable `.git` metadata after confirming internal structure (`ref: refs/` and `[core]` configuration).
   - **CORS Detected**: Flagged the wildcard origin combined with credentialed access.
2. **Accurate Non-Findings**:
   - **SPA `.env` Fallback**: Correctly identified the HTTP 200 HTML document as an application index page rather than an environment file, reporting no `.env` exposure.
   - **Protected Source Map**: Recorded HTTP 403 on the source map probe and reported the check as `passed`, avoiding a false alert for an inaccessible map.
   - **Public Keys Ignored**: Intentionally public tokens (such as Stripe `pk_test_...` and Supabase anon JWTs) were recognized by the allowlist and omitted from findings.
3. **Score Calculation**:
   Running the current scoring function on these findings placed the target in the **Critical exposure** band (raw score under 30), driven by the presence of multiple critical secret exposures and high-severity Git metadata.

---

## 3. What is Checked & Pipeline Coverage

LeakLens categorizes checks into implemented detectors and planned extensions defined in the shared coverage module (`packages/shared/src/check.ts`).

### Check Registry & Status

| Check ID              | Title                                            | Category      | Status in Engine                                                      |
| :-------------------- | :----------------------------------------------- | :------------ | :-------------------------------------------------------------------- |
| `LL-CHECK-KEYS`       | Secret and API keys exposed in public JavaScript | Secrets       | **Implemented**                                                       |
| `LL-CHECK-ENV`        | Publicly reachable .env files                    | Configuration | **Implemented**                                                       |
| `LL-CHECK-GIT`        | Publicly reachable .git repository metadata      | Configuration | **Implemented**                                                       |
| `LL-CHECK-SOURCEMAPS` | Public production source maps                    | Configuration | **Implemented**                                                       |
| `LL-CHECK-CORS`       | Overly permissive CORS settings                  | Network       | **Implemented**                                                       |
| `LL-CHECK-SUPA-ANON`  | Supabase tables readable without login           | Database      | **Not yet supported** (reports `could_not_test` if Supabase detected) |
| `LL-CHECK-SUPA-RLS`   | Missing row-level security on Supabase tables    | Database      | **Not yet supported** (reports `could_not_test` if Supabase detected) |
| `LL-CHECK-STORAGE`    | Public storage buckets                           | Storage       | **Not yet supported** (reports `could_not_test`)                      |
| `LL-CHECK-FIREBASE`   | Open Firebase database rules                     | Database      | **Not yet supported** (reports `could_not_test` if Firebase detected) |

### Scanner Execution Pipeline

The background worker pipeline (`apps/worker/src/pipeline/engine.ts`) executes five sequential stages:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Scan Pipeline Stages                            │
├────────────┬───────────────────────────────────────────────────────────┤
│ Stage 0    │ Fetching app                                              │
│            │ Fetches root URL, follows verified redirects, captures    │
│            │ HTTP headers and initial HTML body.                       │
├────────────┼───────────────────────────────────────────────────────────┤
│ Stage 1    │ Reading bundle                                            │
│            │ Discovers public script assets on verified hostname;      │
│            │ downloads script bodies and extracts source map URLs.     │
├────────────┼───────────────────────────────────────────────────────────┤
│ Stage 2    │ Checking Supabase                                         │
│            │ Passively identifies framework and provider signatures    │
│            │ in DOM and asset text (React, Vite, Supabase, Firebase).  │
├────────────┼───────────────────────────────────────────────────────────┤
│ Stage 3    │ Checking storage                                          │
│            │ Evaluates CORS preflight headers and runs registered      │
│            │ detector modules against extracted context.               │
├────────────┼───────────────────────────────────────────────────────────┤
│ Stage 4    │ Building report                                           │
│            │ Consolidates findings, executes scoring algorithm, and    │
│            │ records check run results to database.                    │
└────────────┴───────────────────────────────────────────────────────────┘
```

---

## 4. Limitations & Exclusions

LeakLens is a lightweight reconnaissance tool focused strictly on publicly accessible client-side exposures. **It does not perform penetration testing, exploit development, or comprehensive vulnerability assessments.**

As defined in `packages/shared/src/check.ts` (`EXPLICIT_EXCLUSIONS`), LeakLens explicitly excludes:

- Server, operating system, and network infrastructure vulnerabilities.
- WordPress and third-party CMS plugin or theme vulnerabilities.
- Malware identification or compromised system remediation.
- Business logic flaws in application source code.
- Protected endpoints requiring authentication or credentials.
- Private code repository analysis.
- Vulnerabilities within external third-party services.
- Denial-of-service, load testing, and performance degradation checks.

Every scan report includes the disclosure caption:

> _"Based only on the checks listed. Not a full security audit."_

---

## 5. How the Engine Works

### 5.1. Verification Engine

To ensure scans target only authorized domains, LeakLens requires ownership verification before initiating probes (`packages/shared/src/verification.ts` and `apps/api/src/modules/verification`):

- **Supported Verification Methods**:
  1. **DNS TXT Record**: Probes `_leaklens.<domain>` for a TXT record containing `leaklens-verification=ll_<token>`.
  2. **HTML Meta Tag**: Inspects the homepage HTML `<head>` for `<meta name="leaklens-verification" content="<token>" />`.
  3. **Verification File**: Requests `/.well-known/leaklens.txt` expecting content `leaklens-verification=ll_<token>`.
- **Public Suffix Rejection**: Uses the Mozilla Public Suffix List (`publicSuffix.ts`) to reject registrations of platform root domains (such as `vercel.app`, `netlify.app`, or `pages.dev`). Users must verify their distinct tenant subdomain or custom apex.
- **30-Day Expiration**: Verifications expire 30 days after confirmation. The scan worker verifies domain expiration prior to executing jobs.

### 5.2. Network Sandbox & SSRF Isolation

All outbound HTTP requests from the scanner use a hardened networking layer (`packages/security`):

- **SSRF Prevention (`network.ts`)**: Resolves DNS before socket creation and blocks private and sensitive ranges:
  - Loopback (`127.0.0.0/8`, `::1`)
  - Private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Cloud Instance Metadata Services (`169.254.169.254`)
  - Shared CGNAT address spaces (`100.64.0.0/10`)
  - IPv4-mapped IPv6 representations
- **IP-Pinned Undici Dispatcher (`http.ts`)**: Prevents Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks by binding the connection socket directly to the validated IP address while preserving the original `Host` header and SNI for TLS negotiation.
- **Scanner User-Agent**: Outbound requests declare identification:
  ```
  User-Agent: LeakLensScanner/1.0 (+https://leaklens.com/about-scanner)
  ```

### 5.3. Detection Engine

Detectors evaluate client-side assets using passive analysis:

- **Secrets (`packages/detectors/src/secrets`)**: Matches patterns for OpenAI API keys, Stripe secret keys (`sk_live_...`, `sk_test_...`), GitHub personal access tokens (`ghp_...`, `github_pat_...`), AWS access keys (`AKIA...`, `ASIA...`), and private key blocks (`-----BEGIN PRIVATE KEY-----`). Harmless public identifiers (Stripe `pk_...`, Supabase anon JWTs, and Firebase web keys) are filtered out via `isKnownPublicKey`.
- **Environment Files (`packages/detectors/src/sensitiveFiles/env.ts`)**: Probes `/.env`, `/.env.production`, and `/.env.local`. Checks for HTML doctypes or tags, verifies `KEY=VALUE` formatting, and extracts only variable names without recording values.
- **Git Metadata (`packages/detectors/src/sensitiveFiles/git.ts`)**: Checks `/.git/HEAD` and `/.git/config`. Validates internal Git structures (`ref: refs/` or `[core]`). Probes for `/.git/index` to determine if object retrieval is possible, consolidating results into a single finding.
- **Source Maps (`packages/detectors/src/sensitiveFiles/sourceMaps.ts`)**: Detects `//# sourceMappingURL=` directives. If referenced maps return HTTP 403 or 404, or do not contain valid source map JSON (`version`, `sources`, `mappings`), the check passes.
- **CORS Configuration (`packages/detectors/src/cors`)**: Evaluates preflight responses and flags combinations of `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`.

### 5.4. Scoring Algorithm

The exposure score (`packages/shared/src/scoring.ts`) is computed deterministically on a 0–100 scale:

$$\text{Raw Score} = \text{round}\left(100 \times e^{-\frac{\text{totalWeight}}{25}}\right)$$

#### Severity Weights

- **Critical**: 10
- **High**: 5
- **Medium**: 2
- **Low**: 1

#### Diminishing Returns

Findings are grouped by `type`. Within each group, findings are sorted by severity:

- The first finding of a given type contributes **100%** of its weight ($1.0 \times \text{weight}$).
- The second and subsequent findings of the same type contribute **50%** of their weight ($0.5 \times \text{weight}$).

#### Score Bounds & Properties

- **Minimum Score Floor**: If at least one check ran, the displayed score is capped at a minimum of **1** rather than 0.
- **Incomplete Test Cap**: If any check could not run (status `could_not_test`), the maximum score is capped at **99**.
- **Clean Score Condition**: A score of **100** requires that every implemented check ran and passed with zero findings.

#### Score Bands & Labels

| Score Range  | Band       | UI Label                          |
| :----------- | :--------- | :-------------------------------- |
| **0 – 29**   | `critical` | Critical exposure                 |
| **30 – 59**  | `high`     | High exposure                     |
| **60 – 84**  | `moderate` | Moderate exposure                 |
| **85 – 100** | `low`      | Low exposure in the checks we ran |

#### Worked Example

Consider a scan resulting in:

1. One critical OpenAI key exposure (`LL-SECRET-OPENAI`, weight = 10).
2. One high-severity permissive CORS policy (`LL-CORS-001`, weight = 5).

Because the two findings belong to different types, both contribute full weight:
$$\text{totalWeight} = 10 + 5 = 15$$
$$\text{Raw Score} = \text{round}\left(100 \times e^{-\frac{15}{25}}\right) = \text{round}(100 \times e^{-0.6}) \approx \text{round}(54.88) = 55$$

The resulting score is **55/100**, categorized in the **High exposure** band (`high`).

### 5.5. Differential Comparison & Fingerprinting

Rescans track changes between successive assessments (`packages/shared/src/fingerprint.ts` and `comparison.ts`):

- **Fingerprint Inputs**: Each finding generates a SHA-256 hash derived from:
  1. Normalized hostname (lowercase, stripped protocol and port).
  2. Finding type (e.g., `LL-SECRET-OPENAI`, `LL-FILE-GIT`).
  3. Normalized location (asset build hashes like `index-Bs6Dobp1.js` stripped to `index.js`, query string parameters sorted alphabetically).
  4. Secret preview info (masked prefix and trailing 4 characters; never raw secret values).
- **Comparison Classifications**:
  - **Unchanged**: Finding fingerprint present in both scans.
  - **New**: Finding fingerprint present only in the later scan.
  - **Resolved**: Finding present in the earlier scan, absent in the later scan, **and** the corresponding check ran successfully in the later scan.
  - **Not tested in this scan**: Finding present in the earlier scan, absent in the later scan, but the corresponding check failed to run (status `could_not_test`). This avoids falsely marking issues as resolved when a probe times out.

### 5.6. Worker Queue & Database Connections

- **Job Queue (`apps/worker/src/queue.ts`)**: Background scan tasks are managed via `pg-boss` backed by PostgreSQL.
- **Connection Handling & SSL**:
  When connecting to managed database poolers (such as Supabase Transaction Poolers), the worker strips `sslmode` query parameters and passes `ssl: { rejectUnauthorized: false }`. Note that this explicitly disables TLS certificate verification on the worker database connection.

### 5.7. Knowledge Base & Remediation Prompts

The knowledge base (`packages/kb`) maps findings to actionable remediation material:

- Plain-English descriptions of realistic consequences.
- Step-by-step engineering checklists.
- Parameterized prompts formatted for AI coding tools (Lovable, Bolt.new, Cursor, v0), instructing agents to migrate client-side secrets into serverless edge functions or environment configurations.

---

## 6. Design & User Experience

LeakLens features an editorial, high-contrast design language avoiding fear-based alert styling. For an in-depth breakdown of typographic hierarchy, spatial motion, progressive disclosure, and the companion state machine, see [docs/design.md](docs/design.md).

---

## 7. Monorepo Architecture

```
LeakLens/
├── apps/
│   ├── web/               # React 19 single-page dashboard application
│   │   ├── src/
│   │   │   ├── components/# UI components (Drawers, Modals, Topbar, Companion)
│   │   │   ├── views/     # LoggedInApp, MarketingView, AuthScreen
│   │   │   └── lib/api/   # HTTP and mock API adapters
│   │   └── index.html
│   ├── api/               # Express REST API service
│   │   ├── prisma/        # PostgreSQL Prisma schema and migrations
│   │   └── src/
│   │       ├── routes/    # Scans, Domains, Verification endpoints
│   │       └── modules/   # Domain verification, DNS resolver, PSL validation
│   └── worker/            # Background scan runner
│       └── src/
│           ├── pipeline/  # 5-stage scan orchestration engine
│           └── queue.ts   # pg-boss consumer and connection management
├── packages/
│   ├── shared/            # Pure scoring, fingerprinting, comparison, and schemas
│   ├── security/          # Pinned-IP Undici client, SSRF guard, secret masking
│   ├── detectors/         # Secret, CORS, .git, .env, and source map detectors
│   └── kb/                # Remediation knowledge base and AI prompt templates
└── docs/
    └── design.md          # UI/UX design rationale and typography details
```

---

## 8. Installation & Setup

### Prerequisites

- **Node.js**: v20 or v22 LTS
- **pnpm**: v10+
- **PostgreSQL**: Local instance or Supabase database

### 1. Clone & Install

```bash
git clone https://github.com/richkid2xi/LeakLense.git
cd LeakLense
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Update `.env` with your PostgreSQL database credentials (`DATABASE_URL`, `DIRECT_URL`) and Supabase authentication keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

### 3. Initialize Database

```bash
# Generate Prisma client
pnpm --filter @leaklens/api prisma:generate

# Push schema to database
pnpm --filter @leaklens/api prisma db push
```

### 4. Run Development Servers

```bash
# Run all workspace applications concurrently:
pnpm dev:all

# Or run individual applications:
pnpm dev        # Web Client (Vite)
pnpm dev:api    # Express REST API
pnpm dev:worker # Scan Worker
```

---

## 9. Running Tests

The test suite runs locally using Vitest without requiring active network connectivity:

```bash
# Run all unit and integration tests across packages and apps
pnpm test

# Run TypeScript typechecks across all workspace packages
pnpm typecheck

# Run linter
pnpm lint
```

---

## 10. Security & Responsible Use

1. **Ownership Verification Required**: Scans cannot be executed against any target without completing cryptographic DNS TXT, HTML meta tag, or file challenge verification.
2. **Read-Only Inspection**: Probes are restricted to passive HTTP `GET` and `OPTIONS` requests against public endpoints. LeakLens does not inject payloads, execute fuzzing, or attempt credential brute-forcing.
3. **SSRF Hardened**: Scanner traffic is bounded by IP pinning and subnet restrictions to ensure probes cannot access local or internal network interfaces.

---

## 11. Roadmap

The following capabilities represent potential future enhancements:

- **Headless Browser Execution**: Incorporating headless Chromium to execute single-page applications with dynamic runtime code-splitting.
- **Active Supabase RLS Probing**: Probing PostgREST endpoints to verify whether discovered tables enforce row-level security policies.
- **Storage Bucket Inspection**: Verifying public read access on cloud storage bucket references discovered in assets.
- **CI/CD Integration**: A CLI tool or GitHub Action to flag accidental client-side secret inlining during pull request validation.
- **Scheduled Monitoring**: Periodic automated rescans to identify exposure regressions between deployments.

---

## 12. License

LeakLens is distributed under the [MIT License](LICENSE).
