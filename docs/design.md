# The Psychology Behind the UI & UX Design

The user interface of LeakLens departs radically from traditional cybersecurity software. Rather than relying on alarmist dashboards that induce panic, LeakLens employs an editorial, clinical design language inspired by Swiss typography. Security assessments are presented as rigorous, dignified audit reports, treating developers as peers rather than negligent adversaries.

```
┌────────────────────────────────────────────────────────┐
│                  Design Architecture                   │
├────────────────────────────────────────────────────────┤
│  Aesthetic: Swiss Editorial + High-Contrast Precision  │
│  Typography: Instrument Serif + JetBrains Mono + Inter │
│  Palette: High-contrast Ink (#0e0e0e) & Paper (#f3f3f0)│
│  Philosophy: Calm Guidance over Panic & Fear (FUD)     │
└────────────────────────────────────────────────────────┘
```

---

## 1. The Anti-Fear Security Philosophy

Traditional cybersecurity tools exploit fear, uncertainty, and doubt (FUD) through flashing red banners, animated sirens, and countdown timers. This triggers alarm fatigue and panic, often prompting developers to dismiss alerts or disable security tooling altogether.

LeakLens rejects this model:

- **Calm, Matter-of-Fact Tone**: Findings are described neutrally with clear explanations of what was observed, why it matters, and how to remediate it.
- **No Alarmist Terminology**: The interface avoids loaded claims. Results are framed within the context of the specific checks executed, accompanied by clear disclaimers that scans do not constitute a full security audit.
- **Audit-Grade Restraint**: High-contrast ink on paper backgrounds creates the feel of an official technical document rather than an emergency broadcast.

---

## 2. Typographic Hierarchy & Visual Anchoring

Typography is structured into three distinct functional roles:

- **`Instrument Serif`**:
  - Used for top-level screen titles, hero headers, and the prominent exposure score.
  - The classic editorial serif lends gravitas and dignity to assessments without aggressive styling.
- **`JetBrains Mono`**:
  - Used for technical artifacts, evidence strings, HTTP response codes, file paths, and timestamps.
  - Monospaced clarity conveys machine-verified precision.
- **`Inter`**:
  - Used for body prose, step-by-step remediation instructions, and rationale text.
  - Neutral sans-serif proportions ensure effortless scanning and reading across desktop and mobile screens.

---

## 3. The Ambient Companion Guardian

Positioned in the lower corner of the workspace is the **LeakLens Companion**. Rather than functioning as an intrusive popup chatbot, the Companion acts as an ambient observer:

- **State Machine Integration**: Driven by a deterministic controller and typed event bus (`companionEvents`), the Companion reflects scanner activity (e.g., watching, working, relieved, serious) without obstructing workflow.
- **Contextual Dialogue**: Offers succinct, calm feedback during and after scans without hyperbolic language.
- **Direct Shortcuts**: Provides one-click navigation directly to high-priority findings.
- **Mobile Awareness**: Adapts touch targets, respects safe areas, and hides automatically when modals, drawers, or mobile navigation sheets are open.

---

## 4. Physicality & Spatial Motion

Digital interfaces often feel detached from real-world consequences. LeakLens incorporates tactile, physical metaphors:

- **3D Step Flip Book**: Onboarding and marketing cards utilize perspective depth (`rotateX`, `rotateZ`, `translate3d`) to represent consecutive audit stages with tactile tangibility.
- **Inspection Drawers**: On desktop viewports, finding details slide out in a focused drawer, allowing developers to inspect evidence and technical remediation steps while maintaining full visual context of the score.
- **Off-Canvas Mobile Drawer**: On smaller viewports, navigation collapses into a safe-area-aware off-canvas drawer with touch-friendly targets, maintaining clean ergonomics across phone and tablet screens.

---

## 5. Progressive Disclosure

Security findings are structured in three progressive tiers to prevent cognitive overload:

1. **Executive Insight**: What was discovered, where it resides, and the realistic threat vector.
2. **Manual Engineering Remediation**: Step-by-step technical instructions for human engineers.
3. **AI Copilot Patch**: Parameterized copy-paste prompts tailored for AI coding assistants (Lovable, Bolt.new, Cursor, v0, Windsurf), allowing immediate resolution without context switching.
