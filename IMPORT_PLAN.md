# LeakLens Import Plan: Selective Integration of Figma Make Donor Backend (Revised)

This plan outlines the inventory, architectural mapping, security review, type reconciliation, and execution strategy for importing modular backend components and detector logic from `figma-import` into the LeakLens monorepo.

---

## 1. Inventory & Responsibilities of `figma-import`

### Backend Modules (`figma-import/backend/`)

| Path                                        | Responsibility                                                                                                                                                                                                                                                        |
| :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/types.ts`                          | Core engine type contracts (`EngineFinding`, `CheckResult`, `ScanEngineResult`, `ScanLimits`, `VerificationMethod`). Reconciled into `packages/shared`.                                                                                                               |
| `backend/security/network.ts`               | SSRF prevention: target normalization, port whitelisting (80/443), private/cloud IP blocking (RFC 1918, CGNAT, loopback, link-local, multicast, IPv6 local, IPv4-mapped IPv6, decimal/octal/hex forms, userinfo checks), DNS pre-flight verification, and scope lock. |
| `backend/security/network.test.ts`          | Unit tests for network target normalization, IP range filtering, blocked hosts, and SSRF bypass attempts.                                                                                                                                                             |
| `backend/security/http.ts`                  | Safe fetch wrapper: pinned DNS-to-connection IP dispatcher (preventing DNS rebinding), per-redirect SSRF re-check, redirect hop limits, response byte caps (2MB default), and timeout aborts.                                                                         |
| `backend/verification/challenge.ts`         | Cryptographically secure 32-byte base64url verification token generation, SHA-256 hash generation, token preview masking, and constant-time `timingSafeEqual` comparison.                                                                                             |
| `backend/verification/challenge.test.ts`    | Unit tests for verification token generation, hashing, masking, and constant-time matching.                                                                                                                                                                           |
| `backend/verification/engine.ts`            | Multi-method ownership verification engine: DNS TXT query (`_leaklens.<host>`), well-known file (`/.well-known/leaklens.txt`), and HTML `<meta>` tag check.                                                                                                           |
| `backend/verification/index.ts`             | Public export barrel for verification engine; decomposed into `apps/api/src/modules/verification/*`.                                                                                                                                                                  |
| `backend/scanning/discovery.ts`             | Public asset discovery: parses `<script src>` and `<link rel="modulepreload">` tags and `sourceMappingURL`, enforcing strict target hostname scope locking.                                                                                                           |
| `backend/scanning/technology.ts`            | Passive stack and infrastructure detector: identifies Supabase, Firebase, Next.js, Vite, Vercel, Cloudflare, Netlify from public HTML, script URLs, and headers.                                                                                                      |
| `backend/scanning/rules/secrets.ts`         | High-confidence secret key detector regexes (OpenAI, Stripe, GitHub, AWS, private keys) with evidence masking. Discards raw values immediately. Excludes public keys (`pk_`, anon keys).                                                                              |
| `backend/scanning/rules/secrets.test.ts`    | Unit tests verifying secret detection, prefix/suffix masking, ensuring raw secrets never leak in finding payloads, and ensuring public keys are not flagged.                                                                                                          |
| `backend/scanning/rules/cors.ts`            | Passive CORS misconfiguration detector: flags `Access-Control-Allow-Origin: *` paired with `Access-Control-Allow-Credentials: true`.                                                                                                                                  |
| `backend/scanning/rules/sensitive-files.ts` | Sensitive file exposure detector: probes `/.env`, `/.env.production`, `/.git/HEAD`, `/.git/config` and validates structure to avoid false positives on custom 404s. Only logs variable names, never values.                                                           |
| `backend/scanning/engine.ts`                | Scan engine orchestrator: executes safe page fetch, asset discovery, detectors, and exposure score calculation.                                                                                                                                                       |
| `backend/scanning/index.ts`                 | Public export barrel for scanning engine; integrated into `apps/worker` pipeline.                                                                                                                                                                                     |
| `backend/guidance/templates.ts`             | Parameterized AI fix prompt generator for Lovable, Bolt, Cursor, v0, and generic coding agents.                                                                                                                                                                       |
| `backend/services/verification.ts`          | Challenge record persistence and verification checking service (adapted from Payload CMS to Prisma ORM).                                                                                                                                                              |
| `backend/services/sites.ts`                 | Site creation and owner-scoped listing service (adapted from Payload CMS to Prisma ORM).                                                                                                                                                                              |
| `backend/services/scans.ts`                 | Scan queueing, state updates, and finding persistence service (adapted from Payload CMS to Prisma ORM + pg-boss).                                                                                                                                                     |
| `backend/services/workspaces.ts`            | Workspace boundary service. **DEFERRED**: User-scoped tenancy is used instead.                                                                                                                                                                                        |
| `backend/api/http.ts`                       | HTTP error definitions (`HttpError`) and 64KB-capped JSON request body reader (adapted to Express middleware).                                                                                                                                                        |
| `backend/auth/app-auth.ts`                  | Next.js cookie session management with Payload CMS user authentication (REJECTED; keep Express Supabase Auth).                                                                                                                                                        |
| `backend/access.ts`                         | Payload CMS collection access control rules (REJECTED; out of stack).                                                                                                                                                                                                 |
| `backend/collections/index.ts`              | Payload CMS collection schema definitions (REJECTED; out of stack).                                                                                                                                                                                                   |
| `backend/NEXT_STEPS_PROMPTS.md`             | Architectural notes and prompts from donor. (REJECTED from repo import; reference only).                                                                                                                                                                              |
| `backend/README.md`                         | Donor backend architecture documentation. (REJECTED from repo import; reference only).                                                                                                                                                                                |

### Frontend & Donor Infrastructure (`figma-import/src/` & root)

| Path                                                                            | Responsibility                                                                                                          |
| :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| `src/app/(frontend)/LeakLensApp.tsx`                                            | Earlier 820-line single-page prototype; lacks Data-Access Layer, interactive modals, and rescan comparison. (REJECTED). |
| `src/app/(frontend)/styles.css`                                                 | Global CSS stylesheet; identical to `apps/web/src/index.css`. (REJECTED).                                               |
| `src/app/(frontend)/layout.tsx`, `page.tsx`, `not-found.tsx`                    | Next.js frontend wrappers. (REJECTED).                                                                                  |
| `src/app/(frontend)/.figma/make/*`                                              | Proprietary Figma Make asset server route. (REJECTED).                                                                  |
| `src/app/(frontend)/api/leaklens/auth/[action]/route.ts`                        | Next.js route for auth. Input validation logic reviewed and adapted to `apps/api/src/routes/auth.ts`.                   |
| `src/app/(frontend)/api/leaklens/scans/route.ts` & `[id]/route.ts`              | Next.js routes for scans. Input validation and ownership checks reviewed and adapted to `apps/api/src/routes/scans.ts`. |
| `src/app/(frontend)/api/leaklens/sites/route.ts` & `[id]/verification/route.ts` | Next.js routes for sites & verification. Validation adapted to `apps/api/src/routes/domains.ts`.                        |
| `src/app/(frontend)/api/leaklens/workspaces/route.ts`                           | Next.js route for workspaces. (DEFERRED with workspaces).                                                               |
| `src/app/(payload)/*`                                                           | Payload CMS admin routes and GraphQL playground. (REJECTED).                                                            |
| `src/collections/*`                                                             | Payload CMS collection schemas. (REJECTED).                                                                             |
| `src/lib/payload.ts`                                                            | Payload CMS client initialization helper. (REJECTED).                                                                   |
| `src/lib/make-custom-code.tsx` & `make-site-settings.ts`                        | Proprietary Figma Make helpers. (REJECTED).                                                                             |
| `public/*`                                                                      | Static icons and brand SVGs; identical to `apps/web/public/*`. (REJECTED).                                              |

---

## 2. Secrets Audit Statement (figma-import)

A systematic search across `figma-import` for hard-coded keys, tokens, service-role keys, default passwords, connection strings, and `.env` files revealed:

- **`.env` files**: **NONE** found.
- **Hard-coded live secrets**: **NONE** found.
- **Patterns present**:
  - `figma-import/backend/scanning/rules/secrets.ts`: Detection regex patterns only.
  - `figma-import/backend/scanning/rules/secrets.test.ts`: A synthetic dummy test token (`sk-proj-abcdefghijklmnopqrstuvwxyz123456`) in test fixtures.
- **Conclusion**: No live or production credentials exist in `figma-import`. No secret rotation is required.

---

## 3. Frontend Comparison

1. **Static Assets (`public/`)**: All 10 files in `figma-import/public/` are identical to `apps/web/public/`.
2. **Styles (`styles.css` vs `apps/web/src/index.css`)**: Identical design tokens, font definitions, and grid classes.
3. **Application UI (`LeakLensApp.tsx` vs `apps/web/src/App.tsx`)**:
   - `figma-import/src/app/(frontend)/LeakLensApp.tsx` is an older 820-line prototype without Data-Access Layer integration or modals.
   - `apps/web/src/App.tsx` (2011 lines) is the canonical approved UI with full DAL integration (`apps/web/src/lib/api`), interactive modals (`VerificationModal`, `FixPromptModal`, `FindingDetailModal`), coverage documentation, and rescan comparison.
   - **`apps/web` remains the single source of truth for UI appearance and logic.**

---

## 4. Module Classification Table

| Donor Source Path                            | Target Monorepo Path                                        |      Class      | Security Review Summary                                                                                                                                                                                                                    | Dependencies                    | Risk |
| :------------------------------------------- | :---------------------------------------------------------- | :-------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------ | :--: |
| `backend/types.ts`                           | `packages/shared/src/*`                                     |    **ADAPT**    | Reconciled into canonical shared types. Browser-safe.                                                                                                                                                                                      | `zod`                           | Low  |
| `backend/security/network.ts`                | `packages/security/src/network.ts`                          | **ADAPT / FIX** | DNS pinned lookup to prevent rebinding; blocks RFC 1918, CGNAT, loopback, cloud metadata (169.254.169.254), IPv4-mapped IPv6, octal/hex IPs, userinfo tricks.                                                                              | `node:dns/promises`, `node:net` | Med  |
| `backend/security/http.ts`                   | `packages/security/src/http.ts`                             |     **FIX**     | Pinned connection dispatcher. User-Agent set to `LeakLensScanner/1.0 (+https://<site>/about-scanner)`. Caps responses (2MB default). Re-checks on every redirect hop. On truncation/timeout, records `could_not_test` instead of `passed`. | `undici`                        | Med  |
| `backend/security/network.test.ts`           | `packages/security/src/network.test.ts`                     |    **PORT**     | Tests SSRF filters, rebinding, and IP format bypasses.                                                                                                                                                                                     | `vitest`                        | Low  |
| `backend/verification/challenge.ts`          | `apps/api/src/modules/verification/token.ts`                |    **PORT**     | 32-byte crypto token, SHA-256 hashed, preview masked, constant-time `timingSafeEqual`.                                                                                                                                                     | `node:crypto`                   | Low  |
| `backend/verification/challenge.test.ts`     | `apps/api/src/modules/verification/token.test.ts`           |    **PORT**     | Tests constant-time token comparison and hashing.                                                                                                                                                                                          | `vitest`                        | Low  |
| `backend/verification/engine.ts`             | `apps/api/src/modules/verification/*`                       | **ADAPT / FIX** | Decomposed into modular folders (`dns/`, `file/`, `meta/`, `publicSuffix.ts`). Enforces Public Suffix List to reject platform root domains (`vercel.app`, `github.io`).                                                                    | `psl`                           | Low  |
| `backend/verification/index.ts`              | `apps/api/src/modules/verification/index.ts`                |    **ADAPT**    | Verification coordinator barrel.                                                                                                                                                                                                           | none                            | Low  |
| `backend/scanning/discovery.ts`              | `packages/detectors/src/discovery.ts`                       |    **PORT**     | Parses `<script>` and `<link>` tags and sourceMappingURL. Scope-locked to verified hostname.                                                                                                                                               | none                            | Low  |
| `backend/scanning/technology.ts`             | `packages/detectors/src/technology.ts`                      |    **PORT**     | Passive stack detector (Supabase, Firebase, Next, Vite, Vercel, Cloudflare, Netlify).                                                                                                                                                      | none                            | Low  |
| `backend/scanning/rules/secrets.ts`          | `packages/detectors/src/secrets/index.ts`                   | **ADAPT / FIX** | High-confidence secret detection (OpenAI, Stripe, GitHub, AWS, private keys). Masks evidence immediately. Ignores public keys (`pk_`, Supabase anon, Firebase web keys).                                                                   | `node:crypto`                   | Low  |
| `backend/scanning/rules/secrets.test.ts`     | `packages/detectors/src/secrets/secrets.test.ts`            |    **PORT**     | Verifies secrets are masked, raw secrets never leak, and public keys are ignored.                                                                                                                                                          | `vitest`                        | Low  |
| `backend/scanning/rules/cors.ts`             | `packages/detectors/src/cors/index.ts`                      |    **ADAPT**    | Flags wildcard origin with credentials allowed.                                                                                                                                                                                            | none                            | Low  |
| `backend/scanning/rules/sensitive-files.ts`  | `packages/detectors/src/sensitiveFiles/index.ts`            | **ADAPT / FIX** | Checks `.env` and `.git` files with structure validation. Stores only variable names for `.env`, never file bodies.                                                                                                                        | none                            | Low  |
| `backend/scanning/engine.ts`                 | `apps/worker/src/pipeline/engine.ts`                        |    **ADAPT**    | Orchestrates safe fetch, detector runs, and exposure score calculation. Reports `could_not_test` on truncation/timeout.                                                                                                                    | none                            | Low  |
| `backend/scanning/index.ts`                  | `apps/worker/src/pipeline/index.ts`                         |    **ADAPT**    | Pipeline entry point for worker queue.                                                                                                                                                                                                     | none                            | Low  |
| `backend/guidance/templates.ts`              | `packages/kb/src/generator.ts`                              |    **ADAPT**    | Merge agent targets (Lovable, Bolt, Cursor, v0, Generic) into KB generator. Validates inputs against strict schemas.                                                                                                                       | none                            | Low  |
| `backend/services/scans.ts`                  | `apps/api/src/routes/scans.ts` & `apps/worker/src/queue.ts` |    **ADAPT**    | Adapt from Payload CMS to Prisma ORM + pg-boss. Verifies domain ownership before queueing.                                                                                                                                                 | `@prisma/client`, `pg-boss`     | Med  |
| `backend/services/sites.ts`                  | `apps/api/src/routes/domains.ts`                            |    **ADAPT**    | Adapt from Payload CMS to Prisma ORM (`Domain` model). Scoped to authenticated user.                                                                                                                                                       | `@prisma/client`                | Med  |
| `backend/services/verification.ts`           | `apps/api/src/modules/verification/service.ts`              |    **ADAPT**    | Adapt challenge lifecycle to Prisma ORM (`Verification` model). Token expires in 30 days.                                                                                                                                                  | `@prisma/client`                | Med  |
| `backend/services/workspaces.ts`             | none                                                        |   **REJECT**    | Defer workspaces entirely. User-scoped tenancy is used.                                                                                                                                                                                    | none                            | Low  |
| `backend/api/http.ts`                        | `apps/api/src/middleware/errors.ts`                         |    **ADAPT**    | Convert error classes and 64KB JSON body check into Express middleware.                                                                                                                                                                    | `express`                       | Low  |
| `src/app/(frontend)/api/leaklens/*`          | `apps/api/src/routes/*`                                     |    **ADAPT**    | Port input validation and ownership checking into Express route handlers.                                                                                                                                                                  | `express`, `zod`                | Low  |
| `backend/auth/app-auth.ts`                   | none                                                        |   **REJECT**    | Payload JWT rejected; keep Express Supabase Auth JWT middleware.                                                                                                                                                                           | none                            | Low  |
| `backend/access.ts` & `collections/*`        | none                                                        |   **REJECT**    | Payload CMS constructs out of stack.                                                                                                                                                                                                       | none                            | Low  |
| `src/app/(frontend)/*`                       | none                                                        |   **REJECT**    | Outdated draft & Next.js wrappers; `apps/web` is canonical.                                                                                                                                                                                | none                            | Low  |
| `src/app/(payload)/*` & `src/lib/payload.ts` | none                                                        |   **REJECT**    | Payload CMS admin out of stack.                                                                                                                                                                                                            | none                            | Low  |

---

## 5. Architectural Decisions & New Packages

### A. New Package: `packages/detectors`

- Contains all detector modules (`secrets/`, `cors/`, `sensitiveFiles/`, `technology.ts`, `discovery.ts`) and the detector registry.
- Implements a detector interface:
  ```ts
  export interface DetectorContext {
    target: string;
    verifiedHostname: string;
    fetchText: (url: string, init?: RequestInit) => Promise<SafeResponse>;
  }
  export interface Detector {
    id: string;
    title: string;
    appliesTo: (context: DetectorContext) => boolean;
    run: (context: DetectorContext) => Promise<CheckRunResult>;
  }
  ```
- Does **NOT** import from `apps/worker` or `apps/api`. Can be reused in a CLI runner later.

### B. New Package: `packages/security`

- Contains SSRF guard (`network.ts`), safe fetch with pinned connection dispatcher (`http.ts`), scope lock, and secret masking.
- `packages/shared` remains 100% browser-safe (Zod schemas and types only, no Node built-ins).
- Add ESLint import boundary rule preventing `apps/web` from importing `packages/security` or `packages/detectors`.

### C. Workspace Deferral

- Multi-user workspaces are deferred. All domains, verifications, scans, and audit logs are scoped directly to the authenticated `User` (`userId`).

### D. Canonical Types Reconciliation

- `VerificationMethod`: Canonical type in `packages/shared` is `'dns_txt' | 'meta_tag' | 'file'`. Donor values (`dns`, `meta`) map at boundary.
- `Finding`: Canonical single finding shape in `packages/shared` with `type` (ruleId), `severity`, `title`, `meaning`, `why`, `maskedEvidence`, `steps` (technical steps), `verificationSteps`, `references`.
- `apps/web` typecheck passes with zero regressions.

---

## 6. Coverage Honesty & Phase 1 TODOs

The donor contains **NO detectors** for:

1. Supabase open tables & anon row access
2. Supabase missing Row Level Security (RLS)
3. Public cloud storage buckets (S3 / Supabase / Firebase)
4. Firebase Realtime / Firestore database rules

**Policy**:

- In `packages/detectors` and `apps/worker`, these 4 checks are explicitly listed as Phase 1 TODOs.
- During scans, if Supabase or Firebase is detected, the scan pipeline reports `could_not_test` ("Check not yet implemented in Phase 0/1; external inspection requires active provider adapter"). If not detected, it reports `not_applicable`.
- Neither the backend nor the UI will fake passes or claim completion of these checks.
- On truncation or timeout, checks report `could_not_test` with reason, never `passed`.

---

## 7. Data-Access Layer Status (`apps/web/src/lib/api`)

| Feature / Route                                | Mock Mode (`VITE_USE_MOCK=true`) |                                         Real API Mode (`VITE_USE_MOCK=false`)                                          |
| :--------------------------------------------- | :------------------------------: | :--------------------------------------------------------------------------------------------------------------------: |
| Domain Management (`listDomains`, `addDomain`) |      In-memory mock adapter      |                 **Switches to REAL**: Calls Express `POST /api/domains` & `GET /api/domains` (Prisma)                  |
| Domain Verification (`verifyDomain`)           |      Simulated verification      | **Switches to REAL**: Calls Express `POST /api/domains/:id/verify` (live DNS TXT, file, meta check with 30-day expiry) |
| Scan Execution (`startScan`)                   |     Simulated progress timer     |          **Switches to REAL**: Calls Express `POST /api/scans` (enqueues pg-boss job, runs scanner pipeline)           |
| Scan Polling (`getScan`, `listScans`)          |      In-memory mock adapter      |                  **Switches to REAL**: Calls Express `GET /api/scans/:id` & `GET /api/scans` (Prisma)                  |
| Findings & Prompts (`getFinding`)              |     In-memory mock findings      |               **Switches to REAL**: Returns persisted findings with masked evidence & generated prompts                |
| Billing & Checkout                             |      Simulated checkout URL      |                                     **Remains MOCKED/STUBBED** (Phase 3 milestone)                                     |
| Email Alerts                                   |    Simulated console delivery    |                                     **Remains MOCKED/STUBBED** (Phase 3 milestone)                                     |

---

## 8. Test Plan (Fixtures Only, No Live Network)

1. **SSRF Guard (`packages/security`)**:
   - Blocks private IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8, CGNAT 100.64.0.0/10).
   - Blocks IPv6 loopback (`::1`), ULA (`fc00::/7`), link-local (`fe80::/10`).
   - Blocks IPv4-mapped IPv6 (`::ffff:10.0.0.1`, `::ffff:127.0.0.1`).
   - Blocks decimal/octal/hex representations.
   - Blocks userinfo injection (`http://user@evil.com`).
   - Blocks DNS rebinding via pinned IP connection check.
   - Re-checks address after redirect hops and rejects redirects to third-party hostnames.
2. **Truncation & Timeout (`packages/security` & `apps/worker`)**:
   - When response hits byte limit or timeout, returns `could_not_test` with clear reason, never `passed`.
3. **Secrets Detector (`packages/detectors`)**:
   - Detects OpenAI, Stripe secret, GitHub, AWS, and private keys.
   - Correctly ignores public keys: Stripe `pk_live_...`, `pk_test_...`, Supabase `anon` public key, Firebase web API key.
   - Verifies raw secret values are discarded and never present in finding output.
4. **Sensitive Files Detector (`packages/detectors`)**:
   - Detects `.env` and `.git` only when content matches expected format.
   - Returns variable names only for `.env`, never secret values.
5. **Verification Engine (`apps/api`)**:
   - Token generation, SHA-256 hashing, timing-safe matching.
   - Public suffix rejection (rejects `vercel.app`, `netlify.app`, `github.io`, etc.).
   - Re-check on scan: fails scan if verification is missing or older than 30 days.
6. **Ownership & Service Isolation (`apps/api`)**:
   - Users can only list and scan their own domains.
   - Scans cannot be started on unverified or expired domains.
