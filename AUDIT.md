# LeakLens — Front-End Audit (/ui-export)

**Audit Date**: October 2026  
**Auditor**: Senior Full-Stack Engineer  
**Scope**: `/ui-export` (Figma Make prototype export)

---

## 1. File Tree & Asset Structure

```
ui-export/
├── .figma/                     # Figma Make build & preview configuration scripts
│   └── make/                   # analyze-routes, deploy, dev, site.json, etc.
├── public/
│   ├── brands/                 # SVG logos for AI builders (bolt.svg, cursor.svg, lovable.svg, v0.svg)
│   ├── fonts/                  # Local font file: material-symbols-outlined.ttf
│   ├── apple-touch-icon.png
│   ├── favicon-32x32.png
│   ├── favicon.svg
│   ├── og-image.png
│   └── site.webmanifest
├── src/
│   ├── App.tsx                 # 818 lines — All screens, modals, state, and mock data
│   ├── index.css               # 689 lines — Tailwind v4, custom theme tokens, typography, animations
│   ├── main.tsx                # React 19 mount point (<App /> into #root)
│   └── vite-env.d.ts           # Vite client types
├── index.html                  # HTML entry with meta tags, SEO tags, JSON-LD, font preload
├── package.json                # React 19.0, Tailwind v4.0, Vite 8.0, TypeScript 5.7
├── tsconfig.json               # Path alias @/* pointing to ./src
└── vite.config.ts              # Vite configuration with Figma Make plugins and Tailwind v4
```

---

## 2. Screens & Routes Found

The prototype does not currently use `react-router-dom`; all navigation is controlled via React component state in `App.tsx`:

- Root view state: `view: "marketing" | "auth" | "app"`
- Auth mode state: `authMode: "login" | "signup" | "forgot"`
- Application screen state: `screen: "new" | "verify" | "progress" | "results" | "history" | "apps" | "compare" | "settings" | "failed"`

### Screens Mapped:

1. **Landing Page (`view === "marketing"`)**:
   - Sticky navigation with anchors (`#findings`, `#coverage`, `#how`, `#safety`, `#faq`, `#scan`) and login button
   - Hero with interactive particle background (`AstralField`), URL input with inline validation (`UrlForm`), and simulated CLI scanning visual (`LayerDiagram`)
   - Stats banner ("3 min typical scan time", "0 changes made")
   - "What we check" checklist (6 core items)
   - "Signal, not noise" interactive illustrative charts (Keys, Tables, Buckets)
   - Scope & Coverage section (`CoverageContent`) detailing what is and is not checked
   - "How it works" 3-step interactive accordion with card stack visual
   - Sample Finding card (`LL-KEY-001` with one-click fix prompt copy)
   - Safety by design value props
   - Supported AI builders strip (Lovable, Bolt, Cursor, v0, Any website)
   - FAQ interactive accordion
   - Closing CTA with scan form
   - Footer with disclaimer and legal links
   - Interactive companion mascot (`Companion`)

2. **Simulated Auth (`view === "auth"`)**:
   - `login`: Email and password input with error simulation
   - `signup`: Name, email, password input
   - `forgot`: Password reset link simulated dispatch

3. **Ownership Verification Modal / Screen (`screen === "verify"`)**:
   - Verification tabs: DNS TXT record (`_leaklens`), HTML `<meta>` tag, and Verification file (`/.well-known/leaklens.txt`)
   - Copyable code blocks (`CopyBlock`)
   - Verification status states: `Waiting`, `Checking`, `Verified`, `Failed`
   - Authorization confirmation

4. **New Scan Screen (`screen === "new"`)**:
   - App URL input with client-side URL validation
   - Builder selector (Lovable, Bolt, Cursor, v0, Other)
   - Checklist of checks to run
   - Ownership checkbox ("I own this site, or I'm authorised to scan it.")

5. **Scan in Progress (`screen === "progress"`)**:
   - 5-step animated scan stepper (Fetching app → Reading bundle → Checking Supabase → Checking storage → Building report)
   - Elapsed timer and progress bar
   - Option to preview failed scan state

6. **Scan Failed State (`screen === "failed"`)**:
   - Error illustration and retry button

7. **Results Dashboard (`screen === "results"`)**:
   - Exposure score count-up gauge (e.g. 62/100 or 100/100 for clean)
   - Strict copy compliance: clean scans state _"No issues found in the checks we ran. Based only on the checks listed below. Not a full security audit."_ (Never says "secure" or "safe")
   - Summary pills by severity (Critical, High, Medium, Low)
   - Detected stack badges (Supabase, Vite, Vercel)
   - Checks run table with statuses (`Passed`, `Issue found`, `Not applicable`, `Couldn't test` with reasons)
   - Findings table with filter controls (severity filter, status filter: Open, Fixed, Ignored)
   - Toggle to "Preview a clean report" (with UI/Architecture/Performance polish cards)

8. **Finding Detail Drawer (`FindingDrawer`)**:
   - Slide-over drawer with scrim backdrop
   - Severity tag, title, "What this means", "Why it matters", risk callout
   - Masked evidence block
   - Mode switcher: "Fix it yourself" (manual step-by-step instructions) vs "Give it to your agent" (ready-to-paste prompt)
   - Builder prompt tabs: Lovable, Bolt, Cursor, v0, Any agent
   - Status dropdown selector (Open, Fixed, Ignored)

9. **Rescan Comparison (`screen === "compare"`)**:
   - Before (e.g., 41/100) vs After (62/100) score delta
   - Resolved findings list vs New findings list

10. **Scan History (`screen === "history"`)**:
    - Historical scan table with timestamp, scan ID, score, sparkline trend indicator, and completion status

11. **Apps List (`screen === "apps"`)**:
    - Grid of verified domains with scan count, latest score, and status

12. **Settings (`screen === "settings"`)**:
    - User profile (Name, Email)
    - Verified domains management list
    - Notification preferences toggle
    - Danger zone (Delete workspace)

13. **Legal Modals (`LegalModal`)**:
    - Terms of Service & Privacy Policy popups

---

## 3. Candidates for Shared / Reusable UI Components

To maintain clean architecture across the monorepo while preserving 100% of the UI look:

1. `MaterialIcon`: Custom SVG icon component mapping icon names to inline path strings.
2. `AstralField`: Interactive mouse-reactive particle background.
3. `MicroLabel`: Standardized typography component (`.micro`) using JetBrains Mono.
4. `CopyBlock`: Code block with inline copy-to-clipboard state feedback.
5. `ScoreCount`: Smooth cubic-eased numerical score counter.
6. `Companion`: Floating companion character with contextual message bubble.
7. `UrlForm`: Scan URL input form with protocol/hostname validation and error states.
8. `FindingDrawer`: Remediation drawer with agent prompt generator tabs.
9. `LegalModal`: Accessible modal dialog for legal/privacy text.
10. `CoverageContent`: Reusable coverage breakdown (used on marketing & in-app link targets).

---

## 4. Audit of Mock & Hard-Coded Data

All mock data is currently hard-coded directly inside `src/App.tsx`:

| Data Item                    | Location in `App.tsx` | Description / Content                                                                       |
| :--------------------------- | :-------------------- | :------------------------------------------------------------------------------------------ |
| `builderBrands`              | Lines 4–9             | Hardcoded array of builders: Lovable, Bolt, Cursor, v0 with SVG paths.                      |
| `checks`                     | Lines 11–18           | 6 scan checks listed on the landing page and new scan form.                                 |
| `faqs`                       | Lines 20–29           | 8 Q&A pairs.                                                                                |
| `coverageChecks`             | Lines 31–39           | 7 items checked by LeakLens.                                                                |
| `coverageExclusions`         | Lines 41–50           | 8 items explicitly excluded from scope.                                                     |
| `steps`                      | Lines 52–56           | 3 how-it-works steps.                                                                       |
| `sampleFindings`             | Lines 527–537         | 9 hardcoded findings across Critical, High, Medium, Low with masked evidence and fix steps. |
| `scanSteps` & `scanMessages` | Lines 539–540         | 5 simulated progress steps and status messages.                                             |
| `checksRun`                  | Lines 541–549         | 7 check runs with statuses and mock reasons.                                                |
| Prompt Lead Texts            | Lines 590–596         | Builder prompt prefixes (`Lovable`, `Bolt`, `Cursor`, `v0`, `Any agent`).                   |
| Scan History Rows            | Line 777              | Hardcoded historical scans (`LL-2025-031`, `LL-2025-024`, `LL-2025-018`).                   |
| Rescan Comparison Data       | Lines 770–771         | Hardcoded Before/After scores (41 vs 62), resolved and new issues count.                    |
| User Profile                 | Lines 702, 792        | "Alex Morgan", `alex@example.com`.                                                          |
| Workspace / Domain           | Lines 701, 784, 793   | "Acme Notes", `acme-notes.app`.                                                             |
| Verification Tokens          | Line 727              | Hardcoded token `ll_sample_3a82`.                                                           |

---

## 5. Code That Will Break in Production / Anti-Patterns

1. **State-Based Navigation vs URL Routing**:
   - `App.tsx` uses internal React state (`view`, `screen`). Direct browser back/forward buttons, deep linking to `/scans/:id` or `/settings`, and page reloads will reset the application to marketing or lose the active screen.
   - _Fix_: Move to React Router while preserving all screen state transitions and views.
2. **Simulated Asynchronous Actions (`window.setTimeout`)**:
   - Verification status changes (`Checking` → `Verified` after 700ms) and scan progress (timer advancing progress every 650ms) are hardcoded in `useEffect`/`setTimeout`.
   - _Fix_: Abstract these behind the data-access layer (`lib/api`) so mock adapters can simulate them during testing/offline mode and the HTTP adapter can call the real API.
3. **Hard-Coded Finding Status Mutation**:
   - Updating finding status (`Open`, `Fixed`, `Ignored`) only mutates in-memory state.
   - _Fix_: Route through `markFindingStatus` API method.
4. **Prompt Assembly Security (Prompt Injection Guard)**:
   - In `FindingDrawer`, prompts are concatenated strings: `${promptLead[builder]} ${finding.title} at ${finding.where}...`.
   - Per brief Section 6, prompt generation must use strict typed placeholders from `packages/kb` and never interpolate raw unvalidated content into prompts.
5. **Direct DOM Queries**:
   - Lines like `document.querySelector(".findings-table")?.scrollIntoView()` and `document.querySelectorAll(".grid-section...")` assume elements exist in the DOM synchronously.
6. **Clipboard API**:
   - `navigator.clipboard?.writeText` may fail in insecure contexts or if permissions are denied; needs fallback or try/catch.

---

## 6. Conflicts with Target Stack & Monorepo Migration Plan

| Prototype Implementation                                                            | Target Monorepo Stack                                                             | Action Needed                                                                                                                  |
| :---------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| Single package (`figma-make-app`)                                                   | Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/kb` | Move web app to `apps/web`, set up root `pnpm-workspace.yaml`.                                                                 |
| Figma Make Vite plugins (`figmaSiteConfiguration`, `figmaErrorOverlayReplay`, etc.) | Standard Vite + React + Tailwind v4 for Vercel deployment                         | Clean up proprietary Figma Make build plugins in `apps/web/vite.config.ts` while preserving all Tailwind v4 and React configs. |
| Hardcoded sample data and in-component mock state                                   | Data-access layer in `apps/web/src/lib/api` with `USE_MOCK` flag                  | Extract mock data into `mockAdapter.ts`, expose standard API interface.                                                        |
| Custom ad-hoc types (`Finding`, `Screen`, etc.)                                     | Typed Zod schemas and TypeScript interfaces in `packages/shared`                  | Define domain models in `packages/shared` and import in `apps/web`.                                                            |
| In-memory fix prompts                                                               | `packages/kb` curated templates with strict sanitization                          | Wire prompt templates to `packages/kb` data structures.                                                                        |

---

## 7. Conclusion & Next Steps

The UI prototype exported from Figma Make is complete, aesthetically polished, and adheres to the tone, copy restrictions, and design guidelines specified in the brief. Moving it into `apps/web`, wrapping the mock data behind `apps/web/src/lib/api`, and extracting shared domain contracts into `packages/shared` can be done cleanly without altering a single pixel or CSS class.
