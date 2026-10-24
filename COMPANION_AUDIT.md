# LeakLens Interactive Companion — Technical Audit

**Date**: 2026-10-24  
**Scope**: `apps/web` companion implementation, UX, architecture, tone, and upgrade roadmap.

---

## 1. Current Architecture & Mounting

### 1.1 Files Involved
* **Component**: `apps/web/src/components/common/Companion.tsx` (24 lines)
* **Styling**: `apps/web/src/index.css` (lines 546–553, 560, 692)
* **Mounting Views**:
  * `apps/web/src/views/MarketingView.tsx` (line 387: `<Companion message={botMessage} />`)
  * `apps/web/src/views/AuthScreen.tsx` (line 145: `<Companion message={botMessage} />`)
  * `apps/web/src/views/LoggedInApp.tsx` (line 790: `<Companion message={companionMessage} />`)
* **Icons**: `MaterialIcon.tsx` (`smart_toy`, `close`)

### 1.2 Character Art & Animation Approach
* **Visual Icon**: An ink squircle container (`52x52px`, `border-radius: 16px 16px 5px 16px`, `background: var(--ink)` `#0E0E0E`) housing the Material Symbol `smart_toy`.
* **Indicator Light**: An absolute pseudo-indicator `i` at top-right (`6x6px`, `background: var(--blue-light)` `#8FB4FF` with pulse halo `box-shadow`).
* **Motion**: CSS hover lift (`translateY(-3px) rotate(-2deg)`). Speech bubble opens via a CSS keyframe:
  ```css
  @keyframes companionIn {
    from { opacity: 0; transform: translateY(6px) scale(.98); }
  }
  ```
* **Speech Bubble**: A plain white container (`.companion-note`, `max-width: 270px`, border `1px solid var(--hairline)`, offset drop shadow `7px 7px 0 rgba(14,14,14,.06)`) with a close button and message text.

### 1.3 Mounting Strategy
* Mounted redundantly across three separate top-level route views.
* Each mount maintains independent internal React state (`const [open, setOpen] = useState(true)`), causing state to reset upon view navigation.

---

## 2. Current Behaviour & Dialogue Inventory

### 2.1 States & Interactions
* **State Machine**: Non-existent. Only a boolean toggle (`open: boolean`).
* **Interactions**:
  * Clicking the companion button toggles the speech bubble.
  * Clicking the close icon hides the speech bubble until the component remounts or receives a new message.

### 2.2 Current Dialogue Triggers & Lines
* **Marketing View**:
  * Initial: `"Give me a deployed URL. I’ll look for the things your launch sprint politely ignored."`
  * Validation errors passed via `UrlForm onFeedback`: e.g. `"Please enter a full URL."`, `"Invalid domain."`
* **Auth View**:
  * Signup: `"Create an account to start scanning your deployed apps."`
  * Login: `"Welcome back. Log in to view your scan reports."`
  * Forgot password: `"Enter your email and we will send a password reset link."`
  * Reset sent: `"Password reset email dispatched successfully."`
* **Dashboard View (`LoggedInApp`)**:
  * Initial / General: `"I watch the public edges. Quietly, mostly."`
  * Screen `new`: `"A URL first. Telepathy is still in beta."`
  * Screen `verify` (Failed): `"DNS is taking the scenic route. Try again in a moment."`
  * Screen `progress`: `"You can stop staring at the progress bar. I’ve got this."`
  * Screen `results` (with issues): `"Two critical findings. Your app has character."`
  * Screen `results` (clean): `"No findings. Suspiciously responsible. Nice work."`
  * Screen `settings`: `"The danger zone is accurately named. Refreshing."`

---

## 3. Information Flow & Context Awareness

* **Current Communication**: Purely passive string prop drilling (`message: string`).
* **Context Awareness**:
  * Does not subscribe to scroll position or active landing-page sections.
  * Does not track scan progress milestones or specific finding severities.
  * Does not know if a finding drawer is open.
  * Does not know if a user copied a fix prompt.
  * Does not track user idle time or repeat failures.
  * Does not persist session history or user dismissal across view switches.

---

## 4. Issues, Gaps & Edge Cases

1. **Tone Safety Violations**:
   * `"Two critical findings. Your app has character."` violates the strict rule that jokes must be completely dropped on HIGH and CRITICAL findings. Critical vulnerabilities require concise, serious, actionable guidance.
2. **UI Overlap & Obstruction**:
   * Fixed at `bottom: 24px, right: 24px`, the companion bubble overlaps the bottom action area of the slide-out `FindingDrawer`.
   * On mobile viewports (`< 768px`), the 270px card blocks primary CTAs and touches screen edges.
   * Remains rendered and distracting when modal dialogs (`LegalModal`, verification dialogs) are open.
3. **Accessibility (a11y) Deficits**:
   * Speech bubble lacks `aria-live` configuration.
   * Screen readers announce idle banter identically to critical security alerts.
   * Cannot be operated easily via keyboard navigation without tabbing through the entire viewport.
   * Does not adapt to `prefers-reduced-motion` beyond disabling animations globally.
4. **Repetition & Spam**:
   * Repeats the exact same line every time a user returns to a screen.
   * No rate limiting, cooldowns, or priority hierarchy.

---

## 5. Upgrade Plan

### Phase 1: Event Bus Architecture
* Create a lightweight, strongly typed event bus in `apps/web/src/lib/companion/events.ts`.
* Key events: `route_changed`, `section_in_view`, `scan_started`, `scan_step_changed`, `scan_finished`, `scan_failed`, `verification_started`, `verification_succeeded`, `verification_failed`, `finding_opened`, `fix_prompt_copied`, `finding_status_changed`, `idle_started`, `idle_ended`, `error_shown`.

### Phase 2: State Machine & Controller
* Implement a formal finite state machine in `apps/web/src/lib/companion/controller.ts` with explicit states:
  * `idle`, `curious`, `watching`, `working`, `relieved`, `concerned`, `serious`, `sleeping`, `celebrating`.
* Deterministic state transitions driven solely by bus events.

### Phase 3: Dialogue Engine & Tone Safety
* Define central content dictionary in `apps/web/src/lib/companion/dialogue.ts`.
* Enforce tone constraints:
  * Low severity & idle: dry, subtle snark.
  * High / Critical severity: calm, direct, zero jokes, max 18 words.
  * Clean report: explicit coverage boundary ("No issues found in the checks we ran"), never claiming "secure" or "safe".
* Selection algorithms: cooldown periods, LRU line deduplication, rate limit (max 1 unprompted line per ~8s, paused while typing in inputs).
* Add automated unit tests verifying that no forbidden words (`secure`, `safe`, `guarantee`, `100%`, `unhackable`) appear in any dialogue.

### Phase 4: Local Storage Session Memory
* Track seen lines, scan count, first-visit flag, and mute preference in `localStorage` with safe in-memory fallback.
* Never store sensitive parameters, URLs, or finding payloads.

### Phase 5: Presentation & Actionable Assistance
* Preserve the character art and squircle icon styling.
* Add subtle visual poses/mood indicators for `serious`, `working`, `sleeping`, and `celebrating`.
* Add interactive quick actions inside speech bubbles:
  * *"Show me the worst one"* -> opens highest-severity finding.
  * *"Copy fix prompt"* -> copies remediation instructions to clipboard.
  * *"Show steps again"* -> jumps to verification guidance.
* Auto-dock / auto-minimize when modals or drawers open.
* Persistent Mute ("Hush") toggle.
