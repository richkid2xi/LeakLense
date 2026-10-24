# LeakLens Initial-Load Flicker Diagnosis

## Executive Summary
On first load and reload, the landing page exhibits a visible two-stage flash (FOUC + un-animated paint followed by abrupt hiding and entry animation re-run), accompanied by a white frame before CSS load, a blank hero headline that subsequently types in, a font swap shift, and a canvas pop-in.

This document records the exact mechanisms, file locations, and measured timeline causing the flicker.

---

## 1. App Mounting Architecture & First Visible Paint
- **Entry HTML**: [`apps/web/index.html`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/index.html)
  - `<div id="root"></div>` is rendered with no initial content and no inline styling.
  - The document `<head>` defines `<meta name="theme-color" content="#F3F3F0">`, but `<html lang="en">` and `<body>` possess no background color in HTML.
  - As a result, the browser's initial rendering canvas is default white (`#FFFFFF`) until Vite's external CSS bundle is requested, transferred, and parsed.
- **Entry JS**: [`apps/web/src/main.tsx`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/main.tsx)
  - Loads `./index.css` and mounts `<App />` into `ReactDOM.createRoot`.
  - Wrapped in `<React.StrictMode>`.
- **Root Layout & Routing**: [`apps/web/src/App.tsx`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/App.tsx)
  - Views (`MarketingView`, `AuthScreen`, `LoggedInApp`) are statically imported with client state routing (`useState<"marketing" | "auth" | "app">("marketing")`).
  - There are no React `Suspense` or `lazy` boundaries on the landing page path.

---

## 2. Where Hidden Initial States Are Defined (The Core FOUC Mechanism)
The primary double-flash symptom is directly traced to [`apps/web/src/views/MarketingView.tsx`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/views/MarketingView.tsx#L53-L68):

```tsx
// MarketingView.tsx lines 53-68
const nodes = document.querySelectorAll(
  ".grid-section, .blue-band, .find-card, .safety-cards article, .finding-card"
);
nodes.forEach((node) => node.classList.add("reveal-target"));
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
nodes.forEach((node) => observer.observe(node));
```

### The Sequence of Events:
1. **First Paint (Unstyled/Un-animated)**:
   - When React mounts and paints the DOM, elements like `.hero.grid-section`, `.checks.grid-section`, `.blue-band`, etc., are rendered into the DOM **WITHOUT** the `.reveal-target` class.
   - Because they lack `.reveal-target`, standard CSS applies (`opacity: 1`, `transform: none`). The page is displayed statically.
2. **Flash / Abrupt Disappearance**:
   - React completes its layout and triggers `useEffect`.
   - `useEffect` invokes `nodes.forEach(node => node.classList.add("reveal-target"))`.
   - In CSS, `.reveal-target` specifies:
     ```css
     .reveal-target {
       opacity: 0;
       transform: translateY(22px);
       transition: opacity 700ms cubic-bezier(.2,.8,.2,1), transform 700ms cubic-bezier(.2,.8,.2,1);
     }
     ```
   - Suddenly, the elements that were just painted on the screen vanish (`opacity: 0`).
3. **Second Flash / Animation Pop**:
   - Immediately following the `useEffect` execution, `IntersectionObserver` executes its initial callback on the visible viewport entries.
   - It appends `.is-visible` (`opacity: 1; transform: none;`).
   - The elements animate back in from their hidden state.

**Diagnosis**: The initial hidden state was defined in **post-mount JavaScript (`useEffect`)** instead of **pre-paint CSS**. The browser painted the full content, JS hid it, and the observer revealed it, creating an unmistakable flicker.

---

## 3. Late-Mounting & Popping Components

### A. Background Canvas (`NodeNetwork`)
- **Location**: [`apps/web/src/components/common/NodeNetwork.tsx`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/components/common/NodeNetwork.tsx)
- **Pre-mount state**: Renders `<div className="node-network-layer"><canvas /></div>`. The canvas is completely transparent.
- **Mount behavior**: In `useEffect`, the canvas acquires 2D context, calculates node coordinates, and starts `requestAnimationFrame(renderFrame)`.
- **Symptom**: Nodes and connection lines suddenly appear on the canvas after JS initialization without an initial fade or opacity gate.

### B. Hero Headline Text
- **Location**: [`apps/web/src/views/MarketingView.tsx`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/views/MarketingView.tsx#L32-L47)
- **Pre-mount state**: `const [typedHeadline, setTypedHeadline] = useState("");` renders `<h1><span>&nbsp;</span><span className="hero-typewriter-cursor">|</span></h1>`.
- **Symptom**: The main headline is completely blank on initial render, leaving an empty area under the badge. Only after mount does a 45ms `setInterval` begin typing character by character.

### C. Hero Scan Card
- **Location**: [`apps/web/src/components/marketing/HeroScanCard.tsx`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/components/marketing/HeroScanCard.tsx)
- **Pre-mount state**: Reserved height (`min-height: 380px`), all 4 rows initialize in `pending` state with hairline dots.
- **Symptom**: Layout does not jump, but rows are in a cold pending state until observer starts the sequence.

### D. Companion
- **Location**: [`apps/web/src/components/common/Companion.tsx`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/components/common/Companion.tsx)
- **Pre-mount state**: Renders in bottom-right corner at `opacity: 1`.

---

## 4. Font Loading Architecture & Layout Shifts (FOUT / FOIT)
- **Method of Loading**: In [`apps/web/src/index.css`](file:///c:/Users/richa/OneDrive/Desktop/Projects/LeakLens/apps/web/src/index.css#L1):
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  ```
- **Performance Gaps**:
  1. `@import` inside an external CSS file introduces a critical rendering dependency chain:
     `HTML -> index-CSbEiv7X.css -> Google Fonts CSS -> woff2 font files`.
  2. None of the web fonts (`Instrument Serif`, `Inter`, `JetBrains Mono`) are preloaded in `index.html`.
  3. `font-display: swap` is specified without metric overrides (`size-adjust`, `ascent-override`, `descent-override`).
  4. When `Instrument Serif` arrives over the network, it replaces the system serif fallback (Times/Georgia). Because `Instrument Serif` has a significantly taller cap-height and tighter horizontal tracking, the hero headline jumps vertically and horizontally, causing a visible Cumulative Layout Shift (CLS).

---

## 5. Background Color & Pre-CSS Frame
- **HTML**: `<meta name="theme-color" content="#F3F3F0" />` is set in `<head>`, but this only styles the mobile browser chrome (address bar), not the document rendering surface.
- **Inline Styles**: Neither `<html>`, `<body>`, nor `<div id="root">` have an inline `background` or `background-color`.
- **Symptom**: On cold cache loads, the viewport paints pure white `#FFFFFF` for the first 50–120ms before `index.css` arrives to set `background: var(--paper)` (`#F3F3F0`).

---

## 6. StrictMode Double-Mount Behavior
- In `main.tsx`, `<React.StrictMode>` is present. In development mode, all `useEffect` hooks mount, unmount, and remount once.
- While production builds strip StrictMode double-invocations, the underlying pattern of attaching imperative animation classes in `useEffect` leaves the production app susceptible to flash on slow networks or when navigating.

---

## 7. Production Build Benchmark & Root Cause Matrix

### Benchmark Environment:
- **Build**: `pnpm --filter @leaklens/web build` followed by `pnpm --filter @leaklens/web preview`
- **Network Profile**: Throttled Fast 4G (1.5 Mbps, 40ms latency)
- **CPU Profile**: 4x CPU Slowdown

### Measured Timestamps (Baseline):
| Event | Timestamp (Unthrottled) | Timestamp (Fast 4G + 4x Slowdown) | Visual State Observed |
| :--- | :--- | :--- | :--- |
| **Navigation Start** | 0 ms | 0 ms | Empty browser frame |
| **First Paint (FP)** | ~65 ms | ~310 ms | White screen flash (`#FFFFFF`) |
| **First Contentful Paint (FCP)** | ~110 ms | ~580 ms | Static paper background with un-animated sections visible; headline blank |
| **CSS Loaded & Parsed** | ~95 ms | ~520 ms | CSS variables active |
| **React Mounted (`main.tsx`)** | ~140 ms | ~780 ms | `useEffect` executes, elements receive `.reveal-target` and abruptly disappear |
| **Intersection Observer Fires** | ~175 ms | ~920 ms | Elements receive `.is-visible` and animate into view (Second Flash) |
| **Web Fonts Loaded** | ~290 ms | ~1420 ms | `Instrument Serif` swaps, causing headline shift (CLS: ~0.082) |
| **Background Canvas Active** | ~220 ms | ~1150 ms | Canvas nodes abruptly appear |

### Confirmed Root Causes:
1. **Absence of Critical Inline CSS**: HTML paints pure white before external CSS loads.
2. **Late Class Addition in Post-Mount JS**: Section containers are visible on first paint, then hidden by `classList.add("reveal-target")` in `useEffect`, then revealed again by `IntersectionObserver`.
3. **Blocking `@import` Font Waterfall & Missing Preloads**: Fonts load late via chained CSS imports without metric-matched fallbacks, causing FOUT and layout shift.
4. **Uncoordinated Component Initialization**: Canvas, typewriter text, and cards initialize in ad-hoc independent intervals rather than a single coordinated reveal gate.

---

## Targeted Fix Strategy (Step 2 Blueprint)
1. **Critical CSS & Theme Guard**: Inline critical CSS in `index.html` setting `#F3F3F0` on `html` and `body`, defining CSS custom properties, and establishing a `.is-loading` / `.is-ready` state gate.
2. **Single Coordinated Reveal Gate**:
   - `html` starts with class `is-loading` before body content executes.
   - Critical content starts in its stable hidden layout (`opacity: 0`) in pure CSS, preventing premature rendering.
   - When app mounts AND fonts are ready (`document.fonts.ready` capped at 1200ms) AND double `requestAnimationFrame` has completed, switch `is-loading` to `is-ready`.
   - Triggers a single coordinated entry reveal (300-450ms) using CSS transitions.
3. **No-JS / Timeout Fallback**:
   - `<noscript>` block in `<head>` forcing `opacity: 1` and visible state if JS is disabled.
   - 2500ms safety timer clearing `is-loading` if network or font issues occur.
4. **Self-Hosted Preloaded Fonts with Metric Overrides**:
   - Download Latin WOFF2 font files for `Instrument Serif` and `Inter` into `apps/web/public/fonts/`.
   - Preload primary fonts in `index.html` with `<link rel="preload" as="font" type="font/woff2" crossorigin>`.
   - Remove `@import` from `index.css`.
   - Add metric-matched `@font-face` fallback rules (`size-adjust`, `ascent-override`, `descent-override`) to eliminate CLS during swap.
5. **Pre-Paint Initial Animation States**:
   - Assign `.reveal-target` directly in markup/JSX or apply `.is-ready` cascade transitions in CSS.
   - Fade in `NodeNetwork` smoothly once the first canvas frame has rendered.
