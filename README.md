# LeakLens

> **Passive, zero-false-positive security intelligence for applications built with AI builders and modern web frameworks.**

[![CI Monorepo Tests](https://img.shields.io/badge/tests-158%20passed-brightgreen?style=flat-square)](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20strict-blue?style=flat-square)](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square)](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B%20%7C%2022%20LTS-green?style=flat-square)](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/LICENSE)

LeakLens is a purpose-built, educational security scanner designed to illuminate public exposures in modern web applications. Specifically tailored for products built with AI generation tools (such as **Lovable**, **Bolt.new**, **Cursor**, **v0**, and **Replit Agent**) as well as standard React, Vite, and Next.js applications, LeakLens detects client-side secret leakage, reachable configuration artifacts, permissive cross-origin policies, and storage misconfigurations.

Instead of outputting cryptic compliance jargon, LeakLens translates every finding into plain-English consequences, manual remediation checklists, and **parameterized, 1-click prompts engineered for AI coding agents**.

---

## Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Case Study: The Client-Side Secret Leak in Lovable & Bolt](#2-case-study-the-client-side-secret-leak-in-lovable--bolt)
3. [The Psychology Behind the UI & UX Design](#3-the-psychology-behind-the-ui--ux-design)
4. [Deep-Dive: How Each Engine Module Works](#4-deep-dive-how-each-engine-module-works)
   - [Verification Engine](#41-verification-engine-appsapisrcmodulesverification)
   - [Security Core & Network Sandbox](#42-security-core--network-sandbox-packagessecurity)
   - [Detection Engine & Pipeline](#43-detection-engine--pipeline-packagesdetectors--appsworker)
   - [Scoring & Differential Comparison Engine](#44-scoring--differential-comparison-engine-packagesshared)
   - [Worker Queue & Execution Strategy](#45-worker-queue--execution-strategy-appsworker)
   - [Knowledge Base & AI Prompt Generator](#46-knowledge-base--ai-prompt-generator-packageskb)
   - [Authentication & Identity Scoping](#47-authentication--identity-scoping-appsapi)
5. [Monorepo Architecture](#5-monorepo-architecture)
6. [Room for Scaling & System Roadmap](#6-room-for-scaling--system-roadmap)
7. [Installation, Setup & Testing](#7-installation-setup--testing)

---

## 1. Executive Summary & Problem Statement

### The AI Builder Blind Spot

The emergence of AI coding platforms has catalyzed software creation. Founders and engineers now build production-grade SaaS products in hours. However, the architectural abstractions that make AI builders powerful also introduce subtle, catastrophic security blind spots:

```
┌────────────────────────────────────────────────────────┐
│               AI Builder Generation Trap               │
├────────────────────────────────────────────────────────┤
│  Prompt: "Integrate OpenAI API for chat generation"    │
│                                                        │
│  AI Builder Action:                                    │
│  - Imports OpenAI SDK directly in frontend React code  │
│  - Reads: const key = import.meta.env.VITE_OPENAI_KEY  │
│  - Compiles bundle: key is bundled into public JS chunk│
│                                                        │
│  Developer Assumption:                                 │
│  - "The key is an environment variable, so it's safe"  │
│                                                        │
│  Reality:                                              │
│  - The secret is transmitted to every visitor's browser│
└────────────────────────────────────────────────────────┘
```

1. **Client-Side Secret Embedding**: Developers store API keys (OpenAI, Stripe secret keys `sk_live_...`, GitHub PATs, AWS access keys) in environment variables prefixed with `VITE_` or `NEXT_PUBLIC_`. Build tools like Vite and Webpack inline these strings directly into client bundles.
2. **Single-Page Application (SPA) Fallback Ambiguity**: When an unconfigured server receives a request for `/.env`, standard SPAs serve `index.html` with HTTP 200 OK. Flawed security scanners trigger deafening false alarms, while careless developers assume true `.env` files are unreachable.
3. **Overly Permissive Cross-Origin Resource Sharing (CORS)**: Rapid scaffolding often uses wildcard CORS headers (`Access-Control-Allow-Origin: *`) alongside credential flags, exposing private user payloads to malicious third-party contexts.
4. **Tooling Fatigue and Security FUD**: Traditional penetration testing suites (Qualys, Nessus, SonarQube) generate hundred-page PDFs loaded with false positives, compliance legalese, and zero actionable remediation paths for modern AI builders.

LeakLens solves this by acting as a **passive, zero-false-positive mirror** for developers.

---

## 2. Case Study: The Client-Side Secret Leak in Lovable & Bolt

### Scenario
An indie founder builds an AI copywriter web application using Lovable. The app connects to Supabase for authentication and Stripe for subscriptions.

### The Exposure
- During generation, the AI created an API wrapper inside `src/lib/ai.ts` using `import.meta.env.VITE_OPENAI_API_KEY`.
- The developer added their paid OpenAI key with tier-4 rate limits into their local `.env`.
- When deployed to production on Vercel, the entire JS bundle contained:
  ```javascript
  const Wt="sk-proj-a9F8dK91mZ...[REDACTED]...T3BlbkFJ";
  ```
- Additionally, the developer enabled CORS on their edge functions with `origin: "*"` to resolve browser errors during prototyping.

### How LeakLens Intervened
1. **Verification**: The user verified ownership via an HTML meta tag (`<meta name="leaklens-site-verification" content="...">`). The Verification Engine confirmed subdomain ownership on `app.lovable.app` without permitting broad apex verification.
2. **Network Sandbox**: LeakLens fetched the edge bundles using its IP-pinned Undici client with strict SSRF protection, ensuring no internal network interfaces or metadata services were touched.
3. **Passive Detection**:
   - `SecretsDetector` identified the active OpenAI secret key using high-precision regex with entropy thresholds, while verifying it was not an inert placeholder or public anonymous key.
   - `CorsDetector` observed wildcard reflection with credentials.
   - `SensitiveFilesDetector` confirmed that `/.env` safely routed to the SPA fallback (no false positive), but discovered a publicly accessible `.git/HEAD` reference.
4. **Remediation**: LeakLens calculated an honest exposure score of **35/100 (Critical Exposure)** and generated an AI remediation prompt:
   ```text
   Refactor our OpenAI integration so that the client bundle never has access to the secret key.
   Move the OpenAI API calls into a Supabase Edge Function under /supabase/functions/chat/index.ts.
   Use the Deno environment variable OPENAI_API_KEY on the server side, and invoke the function
   from our frontend using supabase.functions.invoke('chat'). Remove VITE_OPENAI_API_KEY from .env.
   ```
5. **Outcome**: The developer pasted the prompt directly into Lovable. Within 90 seconds, the secret was removed from the client build and migrated to a secure serverless edge function. A follow-up LeakLens rescan recorded a clean score of **100/100**.

---

## 3. The Psychology Behind the UI & UX Design

The user interface of LeakLens is designed to depart radically from corporate security software:

```
┌────────────────────────────────────────────────────────┐
│                  Design Architecture                   │
├────────────────────────────────────────────────────────┤
│  Aesthetic: Swiss Brutalism + Editorial Precision      │
│  Typography: Instrument Serif + JetBrains Mono + Inter │
│  Palette: High-contrast Ink (#0e0e0e) & Paper (#f3f3f0)│
│  Philosophy: Calm Guidance over Panic & Fear (FUD)     │
└────────────────────────────────────────────────────────┘
```

### 1. The Anti-Fear Security Philosophy
Traditional cybersecurity tools exploit fear, uncertainty, and doubt (FUD) through flashing red banners, animated sirens, and countdown timers. This triggers panic, leading developers to dismiss alerts or disable security tooling altogether. LeakLens employs an editorial, clinical aesthetic inspired by Swiss typography. Security reports resemble precise audit printouts, treating developers as intelligent peers rather than negligent adversaries.

### 2. Typographic Hierarchy & Visual Anchoring
- **`Instrument Serif`**: Used exclusively for large numerical scores and screen titles. The classic editorial serif lends gravitas and dignity to security assessments.
- **`JetBrains Mono`**: Used for technical artifacts, evidence strings, HTTP statuses, and timestamps. Monospaced clarity conveys precision and machine verification.
- **`Inter`**: Used for prose explanations, step-by-step instructions, and rationale text, ensuring effortless readability.

### 3. The Ambient Companion Guardian
Floating unobtrusively in the workspace is the **LeakLens Companion**. Rather than an intrusive chatbot, the Companion functions as an ambient observer. Driven by a deterministic state machine and typed event bus (`companionEvents`), the Companion:
- Calms the user during scans ("I watch the public edges. Quietly, mostly.").
- Validates realistic risks without hyperbole.
- Provides 1-click shortcut actions directly into the most critical finding.

### 4. Physicality & Spatial Motion
Digital interfaces often feel ephemeral and untrustworthy. LeakLens incorporates spatial physics:
- **3D Step Flip Book**: On the marketing page and onboarding flow, scan checks animate in a 3D perspective flip card stack with physical depth (`rotateX`, `rotateZ`, `translate3d`).
- **Tactile Drawers**: Finding details slide out on a 620px inspection sheet with a subtle backdrop blur, allowing developers to inspect details without losing context of the overall score.
- **Off-Canvas Mobile Drawer**: On mobile viewports, the desktop sidebar smoothly collapses into an off-canvas drawer with touch-friendly navigation, quick-access settings, and profile controls.

### 5. Progressive Disclosure
Findings are never dumped in an overwhelming raw log. Each finding exposes three progressive tiers of information:
1. **Executive Insight**: What was discovered, where it lives, and the realistic threat vector.
2. **Manual Engineering Remediation**: Step-by-step instructions for human engineers.
3. **AI Copilot Patch**: A copy-paste prompt engineered for prompt-driven builders.

---

## 4. Deep-Dive: How Each Engine Module Works

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                            LeakLens Pipeline                            │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │
                         [ 1. Domain Registration ]
                                      ▼
                        [ 2. Ownership Verification ]
                        (DNS TXT / File / Meta Tag)
                                      ▼
                      [ 3. Pre-Scan Authorization Gate ]
                                      ▼
                   [ 4. Network Sandbox & SSRF Isolation ]
                                      ▼
                     [ 5. 5-Stage Live Scan Pipeline ]
          ┌─────────────┬─────────────┼─────────────┬─────────────┐
          ▼             ▼             ▼             ▼             ▼
      Stage 0       Stage 1       Stage 2       Stage 3       Stage 4
    Fetching App  Reading Bundle Checking DB  Checking S3   Building Report
          │             │             │             │             │
          └─────────────┴──────┬──────┴─────────────┴─────────────┘
                               ▼
                   [ 6. Finding Deduplication ]
                     (Cryptographic Fingerprints)
                               ▼
                  [ 7. Honest Score Calculation ]
                               ▼
                 [ 8. AI Prompt Generation & KB ]
```

### 4.1. Verification Engine (`apps/api/src/modules/verification`)

Scanning unauthorized infrastructure is unethical and illegal. LeakLens enforces cryptographic proof of ownership before a single probe is fired.

- **Verification Methods**:
  1. **DNS TXT Record**: Probes `_leaklens-challenge.<domain>` or apex for `leaklens-site-verification=<token>`.
  2. **Well-Known Challenge File**: Requests `https://<domain>/.well-known/leaklens-challenge.txt` via HTTP and validates token match.
  3. **HTML Meta Tag**: Parses HTML `<head>` for `<meta name="leaklens-site-verification" content="<token>">`.
- **Public Suffix Rejection (`publicSuffix.ts`)**:
  Multi-tenant hosting platforms (e.g., `vercel.app`, `netlify.app`, `github.io`, `lovable.app`, `pages.dev`, `railway.app`, `fly.dev`) host millions of distinct apps under shared apex domains. If a user could verify `vercel.app`, they could scan any competitor on Vercel. LeakLens matches domains against the Mozilla Public Suffix List (PSL). Verification of platform root domains is strictly rejected; users must verify their unique subdomain or custom domain.
- **30-Day Expiry Gate**: Domain verifications expire exactly 30 days after issuance. The worker re-validates domain expiration inside the atomic job transaction. If ownership has lapsed, the scan aborts immediately.

### 4.2. Security Core & Network Sandbox (`packages/security`)

All outbound HTTP probes traverse a hardened security perimeter designed to defeat Server-Side Request Forgery (SSRF) and DNS rebinding:

- **SSRF Isolation (`network.ts`)**:
  Resolves DNS before connection and checks IP addresses against forbidden subnets:
  - IPv4 Private Networks: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - Loopback: `127.0.0.0/8`, `::1`
  - Cloud Provider Instance Metadata Service (IMDS): `169.254.169.254`
  - Carrier-Grade NAT (CGNAT): `100.64.0.0/10`
  - IPv4-Mapped IPv6 and alternative notations (decimal, octal, hex IP formats).
- **Pinned-IP Undici Dispatcher (`http.ts`)**:
  Standard HTTP clients suffer from Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding: a domain resolves to a safe IP during validation, but points to `127.0.0.1` when the socket opens. LeakLens pins the socket connection directly to the validated IP address while preserving the `Host` header and SNI for TLS.
- **Audit Compliance**: All scanner traffic carries an immutable, identification-compliant user agent: `LeakLensScanner/1.0 (+https://leaklens.com/about-scanner)`.

### 4.3. Detection Engine & Pipeline (`packages/detectors` & `apps/worker`)

The scanner pipeline executes in five coordinated stages:

1. **Stage 0: Fetching App**:
   Fetches target landing pages, records HTTP status codes, headers, and redirects, and establishes baseline TLS properties.
2. **Stage 1: Reading Bundle**:
   Discovers client JavaScript and CSS bundles referenced in the DOM. Extracts scripts and scans for embedded API tokens:
   - **Secrets Detector (`packages/detectors/src/secrets`)**: Evaluates regex signatures and Shannon entropy for OpenAI, Stripe (`sk_live_`), GitHub, AWS, and private keys. Explicitly ignores harmless public identifiers (Stripe `pk_`, Supabase anonymous keys, Firebase public config).
3. **Stage 2: Checking Supabase / Databases**:
   Inspects exposed database URLs, evaluates PostgREST public schema exposure, and tests table accessibility.
4. **Stage 3: Checking Storage**:
   Probes public cloud storage buckets (AWS S3, Google Cloud Storage, Supabase Storage) linked from assets.
5. **Stage 4: Building Report**:
   Tests for reachable `.env` files (distinguishing true key-value pairs from SPA HTML fallbacks) and public `.git` directories. Aggregates findings and synthesizes the score.

### 4.4. Scoring & Differential Comparison Engine (`packages/shared`)

- **Honest Score Algorithm (`scoring.ts`)**:
  Scores are calibrated on a strict 0–100 scale:
  $$\text{Score} = \max(0, 100 - \sum \text{Deductions})$$
  - Critical Finding (Active Secret Key, Open Database): -35 pts
  - High Finding (Public `.git`, Permissive CORS): -20 pts
  - Medium Finding: -10 pts
  - Low Finding: -5 pts
  - Score Bands: **Good** (85–100), **Fair** (60–84), **Needs Attention** (0–59).
- **Stable Cryptographic Fingerprinting (`fingerprint.ts`)**:
  Every finding generates an immutable SHA-256 fingerprint from its detector ID, normalized location, and issue type:
  $$\text{Fingerprint} = \text{SHA256}(\text{detectorId} + ":" + \text{location} + ":" + \text{type})$$
  This guarantees that rescans track whether a specific finding is **Fixed**, **Persisting**, or **New**, powering real-time score delta comparisons (`+15`, `-20`).

### 4.5. Worker Queue & Execution Strategy (`apps/worker`)

- **Asynchronous Execution via PgBoss**: Background scan jobs are managed through `pg-boss` on PostgreSQL.
- **SSL Certificate Chain Handling**: Automatically strips incompatible `sslmode` query flags when connecting to managed poolers (such as Supabase Transaction Poolers) and applies secure programmatic SSL configurations, preventing `SELF_SIGNED_CERT_IN_CHAIN` connection failures.
- **Dual-Execution Resilience**: If the worker queue is offline or initializing, the API service seamlessly falls back to direct background thread processing (`processScanJob`), guaranteeing scans never hang.

### 4.6. Knowledge Base & AI Prompt Generator (`packages/kb`)

Security reports are only as useful as the fixes they produce. LeakLens maintains a curated knowledge base (`generator.ts`) containing:
- Exact threat vectors and realistic exploit descriptions.
- Manual verification and remediation instructions.
- Tailored AI prompts configured for Lovable, Bolt.new, Cursor, v0, and Windsurf, enabling developers to remediate vulnerabilities with zero context switching.

### 4.7. Authentication & Identity Scoping (`apps/api`)

- **Supabase Authentication**: Integrated via JWT verification in the API gateway.
- **Verified Email Requirement**: Scans cannot be executed unless the account's email address has been verified.
- **Strict Tenant Isolation**: Users can only inspect, scan, or delete domains associated with their specific `userId`.
- **Custom Modals**: No browser-native `window.confirm()` or `window.alert()` popups. Account deletion and domain removal utilize custom modal dialogs that cascade deletes across all related check runs, findings, and metrics.

---

## 5. Monorepo Architecture

```
LeakLens/
├── apps/
│   ├── web/               # React 19, Vite 8, Tailwind CSS v4, Lucide icons
│   │   ├── src/
│   │   │   ├── components/# Modular UI: Drawers, Modals, Topbar, Companion
│   │   │   ├── views/     # LoggedInApp, LandingPage, AuthView
│   │   │   └── lib/api/   # HTTP Adapter, Mock Adapter, Type definitions
│   │   └── index.html
│   ├── api/               # Express REST backend service
│   │   ├── prisma/        # PostgreSQL schema, migrations, and clients
│   │   └── src/
│   │       ├── routes/    # Scans, Domains, Verification, Findings
│   │       └── modules/   # Verification engine, DNS resolver, PSL
│   └── worker/            # Background scan runner
│       └── src/
│           ├── pipeline/  # 5-stage scan engine
│           └── queue.ts   # PgBoss job consumer & SSL handler
└── packages/
    ├── shared/            # Common scoring, comparison, and fingerprinting
    ├── security/          # SSRF prevention, pinned Undici client, masking
    ├── detectors/         # Pluggable vulnerability detector modules
    └── kb/                # Remediation knowledge base and AI prompt engine
```

---

## 6. Room for Scaling & System Roadmap

LeakLens is architected to scale horizontally. Potential expansion vectors include:

```
┌────────────────────────────────────────────────────────┐
│                    Scaling Roadmap                     │
├────────────────────────────────────────────────────────┤
│  1. Distributed Multi-Region Scanner Agents (US/EU/AP) │
│  2. Headless Browser (Chromium) DOM Execution          │
│  3. CI/CD & Deploy Webhook Integrations                │
│  4. Real-time RLS Deep Simulation Probes               │
│  5. Team Workspaces & Automated Weekly Drift Scans     │
└────────────────────────────────────────────────────────┘
```

1. **Distributed Multi-Region Workers**: Deploying worker agents across multiple AWS/GCP regions to detect geo-restricted CORS policies and CDN-specific asset leaks.
2. **Headless Browser Execution (Chromium via Playwright)**: Integrating lightweight headless browsers to dynamically execute complex single-page apps with heavy runtime code-splitting.
3. **CI/CD & GitHub Actions Integration**: A lightweight CLI and GitHub Action that fails pull requests if AI code generation commits a secret key into client bundles.
4. **Deep Row Level Security (RLS) Probing**: Automated non-destructive probes that query Supabase/PostgREST schema endpoints to verify whether tables have RLS enabled with active policies.
5. **Scheduled Drift Monitoring**: Automated background cron rescans that notify developers via webhooks or email when a deployment introduces security regressions.

---

## 7. Installation, Setup & Testing

### Prerequisites
- **Node.js**: v20 or v22 LTS
- **pnpm**: v10+
- **PostgreSQL**: Local instance or Supabase database

### Installation
```bash
# Clone the repository
git clone https://github.com/richkid2xi/LeakLense.git
cd LeakLense

# Install all workspace dependencies
pnpm install
```

### Environment Configuration
```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

### Database Migrations
```bash
# Generate Prisma Client
pnpm --filter @leaklens/api prisma:generate

# Apply Database Schema
pnpm --filter @leaklens/api prisma db push
```

### Running Services
```bash
# Run web client, API server, and worker concurrently:
pnpm dev:all

# Or run individual services:
pnpm dev        # Web Client (http://localhost:8443)
pnpm dev:api    # REST API (http://localhost:3001)
pnpm dev:worker # Scan Worker
```

### Running the Test Suite
All 158 automated tests run completely in isolation without requiring live network access:
```bash
# Run all tests across the entire monorepo
pnpm test

# Run tests with type checking
pnpm typecheck
```

---

## License

LeakLens is distributed under the [MIT License](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/LICENSE). Built for developers and founders embracing the future of AI-accelerated software creation.
