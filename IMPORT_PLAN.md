# LeakLens Import Plan: Selective Integration of Figma Make Donor Backend

This plan outlines the inventory, architectural mapping, security review, type reconciliation, and execution strategy for importing modular backend components and detector logic from `figma-import` into the LeakLens monorepo.

---

## 1. Inventory & Responsibilities of `figma-import`

### Backend Modules (`figma-import/backend/`)

| Path                                        | Responsibility                                                                                                                                                                                            |
| :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/types.ts`                          | Core engine type contracts (`EngineFinding`, `CheckResult`, `ScanEngineResult`, `ScanLimits`, `VerificationMethod`).                                                                                      |
| `backend/security/network.ts`               | SSRF prevention: target normalization, port whitelisting (80/443), private/cloud IP blocking (RFC 1918, CGNAT, loopback, link-local, multicast, IPv6 local), DNS pre-flight verification, and scope lock. |
| `backend/security/network.test.ts`          | Unit tests for network target normalization, IP range filtering, and blocked hosts.                                                                                                                       |
| `backend/security/http.ts`                  | Safe fetch wrapper: per-redirect SSRF re-check, redirect hop limits, response byte caps (2MB default), and timeout aborts.                                                                                |
| `backend/verification/challenge.ts`         | Cryptographically secure 32-byte base64url verification token generation, SHA-256 hash generation, token preview masking, and constant-time `timingSafeEqual` comparison.                                 |
| `backend/verification/challenge.test.ts`    | Unit tests for verification token generation, hashing, masking, and constant-time matching.                                                                                                               |
| `backend/verification/engine.ts`            | Multi-method ownership verification engine: DNS TXT query (`_leaklens.<host>`), well-known file (`/.well-known/leaklens.txt`), and HTML `<meta>` tag check.                                               |
| `backend/verification/index.ts`             | Public export barrel for verification engine.                                                                                                                                                             |
| `backend/scanning/discovery.ts`             | Public asset discovery: parses `<script src>` and `<link rel="modulepreload">` tags and `sourceMappingURL`, enforcing strict target hostname scope locking.                                               |
| `backend/scanning/technology.ts`            | Passive stack and infrastructure detector: identifies Supabase, Firebase, Next.js, Vite, Vercel, Cloudflare, Netlify from public HTML, script URLs, and headers.                                          |
| `backend/scanning/rules/secrets.ts`         | High-confidence secret key detector regexes (OpenAI, Stripe, GitHub, AWS, private keys) with evidence masking. Discards raw values immediately.                                                           |
| `backend/scanning/rules/secrets.test.ts`    | Unit tests verifying secret detection, prefix/suffix masking, and ensuring raw secrets never leak in finding payloads.                                                                                    |
| `backend/scanning/rules/cors.ts`            | Passive CORS misconfiguration detector: flags `Access-Control-Allow-Origin: *` paired with `Access-Control-Allow-Credentials: true`.                                                                      |
| `backend/scanning/rules/sensitive-files.ts` | Sensitive file exposure detector: probes `/.env`, `/.env.production`, `/.git/HEAD`, `/.git/config` and validates structure to avoid false positives on custom 404s.                                       |
| `backend/scanning/engine.ts`                | Scan engine orchestrator: executes safe page fetch, asset discovery, secrets inspection, source map probing, sensitive file checks, CORS evaluation, stack detection, and exposure score calculation.     |
| `backend/scanning/index.ts`                 | Public export barrel for scanning engine.                                                                                                                                                                 |
| `backend/guidance/templates.ts`             | Parameterized AI fix prompt generator for Lovable, Bolt, Cursor, v0, and generic coding agents.                                                                                                           |
| `backend/services/verification.ts`          | Challenge record persistence and verification checking service (built for Payload CMS).                                                                                                                   |
| `backend/services/sites.ts`                 | Site creation and owner-scoped listing service (built for Payload CMS).                                                                                                                                   |
| `backend/services/scans.ts`                 | Scan queueing, state updates, and finding persistence service (built for Payload CMS).                                                                                                                    |
| `backend/services/workspaces.ts`            | Account and workspace boundary service (built for Payload CMS).                                                                                                                                           |
| `backend/api/http.ts`                       | HTTP error definitions (`HttpError`) and 64KB-capped JSON request body reader.                                                                                                                            |
| `backend/auth/app-auth.ts`                  | Next.js cookie session management with Payload CMS user authentication.                                                                                                                                   |
| `backend/access.ts`                         | Payload CMS collection access control rules.                                                                                                                                                              |
| `backend/collections/index.ts`              | Payload CMS collection schema definitions.                                                                                                                                                                |
| `backend/NEXT_STEPS_PROMPTS.md`             | Architectural notes and prompts for finishing backend services.                                                                                                                                           |
| `backend/README.md`                         | Architecture documentation for the donor backend.                                                                                                                                                         |

### Frontend & Donor Infrastructure (`figma-import/src/` & root)

| Path                                 | Responsibility                                                                                              |
| :----------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| `src/app/(frontend)/LeakLensApp.tsx` | Earlier 820-line single-page prototype; lacks Data-Access Layer, interactive modals, and rescan comparison. |
| `src/app/(frontend)/styles.css`      | Global CSS stylesheet; identical to `apps/web/src/index.css`.                                               |
| `src/app/(frontend)/layout.tsx`      | Next.js root layout wrapper (not used in Vite SPA).                                                         |
| `src/app/(frontend)/page.tsx`        | Next.js route entry point (not used in Vite SPA).                                                           |
| `src/app/(frontend)/not-found.tsx`   | Next.js 404 handler (not used in Vite SPA).                                                                 |
| `src/app/(frontend)/.figma/make/*`   | Proprietary Figma Make asset server route.                                                                  |
| `src/app/(frontend)/api/leaklens/*`  | Next.js API route handlers for auth, scans, sites, verification, workspaces.                                |
| `src/app/(payload)/*`                | Payload CMS administrative application routes and GraphQL playground.                                       |
| `src/collections/*`                  | Payload CMS collection schemas (`Admins`, `Folders`, `Media`, `Tags`).                                      |
| `src/lib/payload.ts`                 | Payload CMS client initialization helper.                                                                   |
| `src/lib/make-custom-code.tsx`       | Proprietary Figma Make custom code component.                                                               |
| `src/lib/make-site-settings.ts`      | Proprietary Figma Make site settings helper.                                                                |
| `public/*`                           | Static icons and brand SVGs; identical to `apps/web/public/*`.                                              |

---

## 2. Frontend Comparison

1. **Static Assets (`public/`)**: All 10 files in `figma-import/public/` are binary-identical to `apps/web/public/` (`apple-touch-icon.png`, `favicon-32x32.png`, `favicon.svg`, `og-image.png`, `site.webmanifest`, `bolt.svg`, `cursor.svg`, `lovable.svg`, `v0.svg`, `material-symbols-outlined.ttf`).
2. **Styles (`styles.css` vs `apps/web/src/index.css`)**: Token definitions, typography imports (Instrument Serif, Inter, JetBrains Mono), grid background calculations, and responsive utilities are identical. `apps/web/src/index.css` is already complete.
3. **Application Component (`LeakLensApp.tsx` vs `apps/web/src/App.tsx`)**:
   - `figma-import/src/app/(frontend)/LeakLensApp.tsx` is an older 820-line draft that uses hard-coded in-memory state and contains no API client calls.
   - `apps/web/src/App.tsx` (2011 lines) is the approved visual UI that has full Data-Access Layer integration (`apps/web/src/lib/api`), interactive modals (`VerificationModal`, `FixPromptModal`, `FindingDetailModal`), complete view navigation, and rescan comparison.
   - **Conclusion**: `apps/web` remains 100% untouched and preserved as the sole source of truth for the frontend. No visual changes will occur.

---

## 3. Classification Table

| Donor Source Path                            | Target Monorepo Path                                        |      Class      | Security Review Summary                                                                                                                                                            | Dependencies                    | Risk |
| :------------------------------------------- | :---------------------------------------------------------- | :-------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------ | :--: |
| `backend/security/network.ts`                | `packages/shared/src/security/network.ts`                   |    **ADAPT**    | Enforces scope lock, blocks RFC 1918, CGNAT, loopback, cloud metadata (169.254.169.254), IPv6 local.                                                                               | `node:dns/promises`, `node:net` | Low  |
| `backend/security/http.ts`                   | `packages/shared/src/security/http.ts`                      |     **FIX**     | **Fix required**: User agent must be updated to `LeakLensScanner/1.0 (+https://<site>/about-scanner)`. Caps size to 2MB, abort timeout.                                            | `node:buffer`                   | Low  |
| `backend/security/network.test.ts`           | `packages/shared/src/security/network.test.ts`              |    **PORT**     | Comprehensive unit tests for SSRF blocked IP logic.                                                                                                                                | `vitest`                        | Low  |
| `backend/verification/challenge.ts`          | `apps/api/src/modules/verification/token.ts`                |    **PORT**     | Unguessable 32-byte crypto token, SHA-256 hashed, preview masked, constant-time comparison via `timingSafeEqual`.                                                                  | `node:crypto`                   | Low  |
| `backend/verification/challenge.test.ts`     | `apps/api/src/modules/verification/token.test.ts`           |    **PORT**     | Tests constant-time token comparison and hashing.                                                                                                                                  | `vitest`                        | Low  |
| `backend/verification/engine.ts`             | `apps/api/src/modules/verification/*`                       | **ADAPT / FIX** | Split into modular sub-folders per method (`dns/`, `file/`, `meta/`). **Fix required**: Add public suffix check to reject platform root domains (`vercel.app`, `github.io`, etc.). | `node:dns/promises`             | Low  |
| `backend/scanning/discovery.ts`              | `apps/worker/src/detectors/discovery.ts`                    |    **PORT**     | Extracts scripts & preloads; enforces scope lock to verified hostname.                                                                                                             | none                            | Low  |
| `backend/scanning/technology.ts`             | `apps/worker/src/detectors/technology.ts`                   |    **ADAPT**    | Passive technology detection (Supabase, Firebase, Next, Vite, Vercel, Cloudflare, Netlify).                                                                                        | none                            | Low  |
| `backend/scanning/rules/secrets.ts`          | `apps/worker/src/detectors/secrets/index.ts`                |    **ADAPT**    | High-confidence secret detection (OpenAI, Stripe, GitHub, AWS, private keys). Immediate masking; raw values discarded.                                                             | `node:crypto`                   | Low  |
| `backend/scanning/rules/secrets.test.ts`     | `apps/worker/src/detectors/secrets/secrets.test.ts`         |    **PORT**     | Verifies secrets are masked and raw values never leak in findings.                                                                                                                 | `vitest`                        | Low  |
| `backend/scanning/rules/cors.ts`             | `apps/worker/src/detectors/cors/index.ts`                   |    **ADAPT**    | Flags wildcard origin with credentials allowed.                                                                                                                                    | none                            | Low  |
| `backend/scanning/rules/sensitive-files.ts`  | `apps/worker/src/detectors/sensitiveFiles/index.ts`         |    **ADAPT**    | Checks `.env` and `.git` exposures with format validation to prevent false positives on custom 404s.                                                                               | none                            | Low  |
| `backend/scanning/engine.ts`                 | `apps/worker/src/pipeline/engine.ts`                        |    **ADAPT**    | Orchestrates safe fetch, asset discovery, detectors, and score calculation. Integrated with pg-boss job processor.                                                                 | none                            | Low  |
| `backend/guidance/templates.ts`              | `packages/kb/src/generator.ts`                              |    **ADAPT**    | Merge into KB prompt generator. Prompt-injection safe: only interpolates typed, validated identifiers.                                                                             | none                            | Low  |
| `backend/services/scans.ts`                  | `apps/api/src/routes/scans.ts` & `apps/worker/src/queue.ts` |    **ADAPT**    | Adapt from Payload CMS persistence to Prisma ORM + pg-boss queue. Enforces domain verification check before queueing.                                                              | `@prisma/client`, `pg-boss`     | Med  |
| `backend/services/sites.ts`                  | `apps/api/src/routes/domains.ts`                            |    **ADAPT**    | Adapt from Payload CMS to Prisma ORM (`Domain` model). Scoped to authenticated user.                                                                                               | `@prisma/client`                | Low  |
| `backend/services/verification.ts`           | `apps/api/src/modules/verification/service.ts`              |    **ADAPT**    | Adapt challenge lifecycle from Payload to Prisma ORM (`Verification` model).                                                                                                       | `@prisma/client`                | Low  |
| `backend/services/workspaces.ts`             | `apps/api/src/routes/workspaces.ts` (or user scope)         |    **ADAPT**    | Adapt workspace ownership boundary to Prisma schema.                                                                                                                               | `@prisma/client`                | Low  |
| `backend/api/http.ts`                        | `apps/api/src/middleware/errors.ts`                         |    **ADAPT**    | Convert Next.js Request/Response helpers into Express middleware.                                                                                                                  | `express`                       | Low  |
| `backend/auth/app-auth.ts`                   | `apps/api/src/middleware/auth.ts`                           |   **REJECT**    | Next.js cookie / Payload auth is rejected; keep Express Supabase Auth JWT middleware.                                                                                              | none                            | Low  |
| `backend/access.ts` & `collections/*`        | none                                                        |   **REJECT**    | Payload CMS constructs out of stack.                                                                                                                                               | none                            | Low  |
| `src/app/(frontend)/LeakLensApp.tsx`         | none                                                        |   **REJECT**    | Incomplete prototype draft. `apps/web/src/App.tsx` is preserved.                                                                                                                   | none                            | Low  |
| `src/app/(frontend)/styles.css`              | none                                                        |   **REJECT**    | Duplicate of `apps/web/src/index.css`.                                                                                                                                             | none                            | Low  |
| `src/app/(frontend)/layout.tsx`, `page.tsx`  | none                                                        |   **REJECT**    | Next.js wrapper files not used in Vite SPA.                                                                                                                                        | none                            | Low  |
| `src/app/(payload)/*` & `src/lib/payload.ts` | none                                                        |   **REJECT**    | Payload CMS admin panel files out of stack.                                                                                                                                        | none                            | Low  |

---

## 4. Duplicates & Resolution

1. **Frontend Prototype**:
   - `figma-import/src/app/(frontend)/LeakLensApp.tsx` (820 lines) vs `apps/web/src/App.tsx` (2011 lines).
   - **Resolution**: Keep `apps/web/src/App.tsx`. Reject donor version.
2. **Global CSS**:
   - `figma-import/src/app/(frontend)/styles.css` vs `apps/web/src/index.css`.
   - **Resolution**: Keep `apps/web/src/index.css`. Reject donor version.
3. **Public Assets**:
   - `figma-import/public/*` vs `apps/web/public/*`.
   - **Resolution**: Keep `apps/web/public/*`. Exactly identical.
4. **Remediation Prompt Generator**:
   - `figma-import/backend/guidance/templates.ts` vs `packages/kb/src/generator.ts`.
   - **Resolution**: Merge donor's agent-specific framing (Lovable, Bolt, Cursor, v0, Generic) into `packages/kb/src/generator.ts` while preserving prompt-injection input sanitization schemas.
5. **Backend Routes & Storage**:
   - `figma-import/backend/services/*` (Payload CMS) vs `apps/api/src/routes/*` (Express + Prisma).
   - **Resolution**: Retain Express + Prisma architecture. Adapt donor business logic into Prisma database calls.

---

## 5. Dependencies to Add or Unify

1. **Core Scanning & Verification**: Requires **ZERO** new runtime dependencies. All network, security, and verification algorithms rely strictly on Node.js built-ins (`node:crypto`, `node:dns/promises`, `node:net`, native `fetch`, native `Headers`, native `URL`, native `Buffer`).
2. **Testing**: Add `vitest` as a devDependency in root `package.json` to run the donor unit tests (`network.test.ts`, `challenge.test.ts`, `secrets.test.ts`) during CI and verification.

---

## 6. Type Conflicts & Reconciliation with `packages/shared`

1. **Findings (`EngineFinding` vs `Finding`)**:
   - Donor `EngineFinding` contains `ruleId`, `ruleVersion`, `severity`, `confidence`, `title`, `summary`, `whyItMatters`, `evidence: { location, maskedValue, summary }`, `technicalSteps`, `verificationSteps`, `references`.
   - `packages/shared/src/finding.ts` contains `FindingSchema` (`type`, `severity`, `status`, `location`, `title`, `meaning`, `why`, `maskedEvidence`, `steps`).
   - **Reconciliation**: Update `packages/shared/src/finding.ts` to fully incorporate `EngineFindingSchema`, mapping `type` <-> `ruleId`, `meaning` <-> `summary`, `why` <-> `whyItMatters`, `steps` <-> `technicalSteps`, and adding `verificationSteps` and `references`.
2. **Verification Methods**:
   - Donor uses `'dns' | 'file' | 'meta'`.
   - `packages/shared/src/verification.ts` has `'dns_txt' | 'meta_tag' | 'file'`.
   - **Reconciliation**: Update `VerificationMethodSchema` in `packages/shared` to support both forms seamlessly (`dns` / `dns_txt`, `meta` / `meta_tag`, `file`).
3. **Scan Results**:
   - Add `ScanEngineResultSchema`, `CheckResultSchema`, and `ScanLimitsSchema` to `packages/shared/src/scan.ts`.

---

## 7. Data-Access Layer Status (`apps/web/src/lib/api`)

| Feature / Route                                | Mock Mode (`VITE_USE_MOCK=true`) |                                Real API Mode (`VITE_USE_MOCK=false`)                                |
| :--------------------------------------------- | :------------------------------: | :-------------------------------------------------------------------------------------------------: |
| Domain Management (`listDomains`, `addDomain`) |      In-memory mock adapter      |        **Switches to REAL**: Calls Express `POST /api/domains` & `GET /api/domains` (Prisma)        |
| Domain Verification (`verifyDomain`)           |      Simulated verification      | **Switches to REAL**: Calls Express `POST /api/domains/:id/verify` (live DNS TXT, file, meta check) |
| Scan Execution (`startScan`)                   |     Simulated progress timer     |  **Switches to REAL**: Calls Express `POST /api/scans` (queues pg-boss job, runs scanner pipeline)  |
| Scan Polling (`getScan`, `listScans`)          |      In-memory mock adapter      |        **Switches to REAL**: Calls Express `GET /api/scans/:id` & `GET /api/scans` (Prisma)         |
| Findings & Prompts (`getFinding`)              |     In-memory mock findings      |      **Switches to REAL**: Returns persisted findings with masked evidence & generated prompts      |
| Billing & Checkout                             |      Simulated checkout URL      |                           **Remains MOCKED/STUBBED** (Phase 3 milestone)                            |
| Email Alerts                                   |    Simulated console delivery    |                           **Remains MOCKED/STUBBED** (Phase 3 milestone)                            |

---

## 8. Open Questions & Recommendations

1. **Detector Placement**:
   - _Option A (Recommended)_: Place detectors in `apps/worker/src/detectors/*` with modular subfolders (`secrets/`, `cors/`, `sensitiveFiles/`, `technology.ts`, `discovery.ts`) implementing a shared detector contract.
   - _Option B_: Create a dedicated `packages/detectors` workspace package.
   - _Recommendation_: **Option A** (`apps/worker/src/detectors/*`), keeping the monorepo lean while preserving modularity.
2. **Shared Security Module**:
   - Place SSRF protection (`network.ts`), safe fetch (`http.ts`), and secret masking in `packages/shared/src/security/*` with a dedicated package export `./security`, allowing both `apps/api` and `apps/worker` to consume the same security utilities without bundling Node built-ins into `apps/web`.
