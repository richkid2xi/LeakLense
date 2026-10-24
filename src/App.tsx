import { FormEvent, useEffect, useRef, useState } from "react";

const BRAND = "LeakLens";
const builderBrands = [
  { name: "Lovable", logo: "/brands/lovable.svg" },
  { name: "Bolt", logo: "/brands/bolt.svg" },
  { name: "Cursor", logo: "/brands/cursor.svg" },
  { name: "v0", logo: "/brands/v0.svg" },
];

const checks = [
  "Exposed API keys",
  "Open Supabase tables",
  "Public storage buckets",
  "Secrets in the client bundle",
  "Missing row-level security",
  "Reachable .env files",
];

const faqs = [
  ["Will LeakLens change my app?", "No. Every check is read-only. LeakLens reports what it can see and gives you a prompt to make the fix yourself."],
  ["How do I prove I own the app?", "Add a temporary DNS TXT record or a meta tag. We verify it before any scan begins."],
  ["Which AI builders do you support?", "LeakLens is designed for apps built with Lovable, Bolt, Cursor and v0."],
  ["Do I need to know security?", "No. Findings are explained in plain English, with a ready-to-paste prompt for your AI builder."],
  ["What does the scan inspect?", "Publicly reachable parts of your app, including frontend bundles, API behavior, databases and storage configuration."],
  ["What does the exposure score cover?", "Only the specific public exposure checks listed in our coverage section. It is not a full security audit or penetration test."],
  ["Does it only work on AI-built apps?", "No. It's tuned for apps from AI builders, but the checks run on any website you own, because they look at what your site exposes, not at who built it."],
  ["Does a clean scan mean I'm secure?", "No. It means we didn't find the specific issues we check for. We list exactly what we do and don't cover so you know where the gaps are."],
];

const coverageChecks = [
  "Secret keys and API keys exposed in your public JavaScript",
  "Supabase tables readable without logging in",
  "Missing row-level security on Supabase tables",
  "Public storage buckets",
  "Reachable .env files, .git folders and source maps",
  "Open Firebase database rules (when Firebase is detected)",
  "Overly permissive CORS settings",
];

const coverageExclusions = [
  "Server, operating system and network vulnerabilities",
  "WordPress and other CMS plugin or theme vulnerabilities",
  "Malware or hacked-site cleanup",
  "Logic flaws in your app's own code or business rules",
  "Anything behind a login",
  "Private repositories and source code review",
  "Third-party services you connect to",
  "Denial-of-service and performance attacks",
];

const steps = [
  { number: "01", title: "Verify", body: "Prove the app is yours with a DNS TXT record or a temporary meta tag." },
  { number: "02", title: "Scan", body: "LeakLens runs read-only checks against the parts of your app that are publicly reachable." },
  { number: "03", title: "Fix", body: "Read a plain-English explanation and paste the tailored fix prompt into your AI builder." },
];

function Arrow() {
  return <MaterialIcon>arrow_forward</MaterialIcon>;
}

function MaterialIcon({ children }: { children: string }) {
  const paths: Record<string, string> = {
    add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z",
    remove: "M19 13H5v-2h14v2Z",
    close: "M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.7 4.29 4.29l6.3 6.3 6.3-6.3 1.41 1.42Z",
    menu: "M3 18v-2h18v2H3Zm0-5v-2h18v2H3Zm0-5V6h18v2H3Z",
    arrow_back: "m20 11v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.42 1.41L7.83 11H20Z",
    arrow_forward: "m12 4 8 8-8 8-1.42-1.41L16.17 13H4v-2h12.17l-5.59-5.59L12 4Z",
    arrow_downward: "m11 4h2v12.17l5.59-5.59L20 12l-8 8-8-8 1.41-1.42L11 16.17V4Z",
    chevron_right: "m9.29 6.71 1.42-1.42L17.41 12l-6.7 6.71-1.42-1.42L14.59 12l-5.3-5.29Z",
    expand_more: "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z",
    check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z",
    error: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z",
    terminal: "M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM9 15.5 7.5 17 3 12.5 7.5 8 9 9.5l-3 3 3 3ZM20 17h-8v-2h8v2Z",
    settings: "M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65-2-3.46-2.49 1a7.21 7.21 0 0 0-1.69-.98L15 3.27h-4l-.38 2.66c-.61.25-1.17.59-1.69.98l-2.49-1-2 3.46 2.11 1.65c-.04.32-.08.66-.08.98s.03.66.08.98l-2.11 1.65 2 3.46 2.49-1c.52.4 1.08.73 1.69.98L11 20.73h4l.38-2.66c.61-.25 1.17-.59 1.69-.98l2.49 1 2-3.46-2.13-1.65ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z",
    apps: "M4 8h4V4H4v4Zm6 12h4v-4h-4v4Zm-6 0h4v-4H4v4Zm0-6h4v-4H4v4Zm6 0h4v-4h-4v4Zm6-10v4h4V4h-4Zm-6 4h4V4h-4v4Zm6 6h4v-4h-4v4Zm0 6h4v-4h-4v4Z",
    radar: "M12 4a8 8 0 1 0 8 8h2A10 10 0 1 1 12 2v2Zm0 4a4 4 0 1 0 4 4h2a6 6 0 1 1-6-6v2Zm9-6-8.38 8.38A2 2 0 1 0 14 12c0-.16-.02-.32-.06-.47L22.42 3 21 2Z",
    smart_toy: "M20 9V7h-2V4h-2v3H8V4H6v3H4v2H2v11h20V9h-2Zm0 9H4V9h16v9ZM8 11h2v2H8v-2Zm6 0h2v2h-2v-2Zm-6 4h8v2H8v-2Z",
    construction: "m13.78 15.3 5.92 5.92 1.41-1.41-5.92-5.92-1.41 1.41ZM17.5 10c1.93 0 3.5-1.57 3.5-3.5 0-.58-.16-1.12-.41-1.6l-2.7 2.7-1.49-1.49 2.7-2.7A3.45 3.45 0 0 0 17.5 3 3.5 3.5 0 0 0 14 6.5c0 .41.08.8.21 1.16L3.06 18.81a1.5 1.5 0 1 0 2.12 2.12L16.34 9.79c.36.13.75.21 1.16.21Z",
    auto_awesome: "m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9ZM11.5 9.5 9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5Z",
    crisis_alert: "M12 2 1 21h22L12 2Zm0 4.04L19.53 19H4.47L12 6.04ZM11 10h2v4h-2v-4Zm0 5.5h2V18h-2v-2.5Z",
    verified_user: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8Z",
    mark_email_read: "M20 4H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h10.1a6.5 6.5 0 0 1-.1-1c0-.34.03-.67.08-1H4V8l8 5 8-5v4.08c.72.11 1.39.34 2 .66V6c0-1.1-.9-2-2-2Zm-8 7L4 6h16l-8 5Zm8.5 4.5L18 18l-1.5-1.5-1 1L18 20l3.5-3.5-1-1Z",
    palette: "M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a1 1 0 0 1 0-2h2a7 7 0 0 0 0-14h-2Zm-5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z",
    account_tree: "M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3h7Z",
    speed: "M20.38 8.57 19.23 10A8 8 0 0 1 20 13a8 8 0 0 1-.59 3H4.59A8 8 0 0 1 4 13a8 8 0 0 1 13.42-5.87L12 12l1.41 1.41 6.97-4.84ZM12 3a10 10 0 0 0-8.66 15h17.32A10 10 0 0 0 12 3Z",
    language: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.92 6h-3.03a15.7 15.7 0 0 0-1.38-3.56A8.06 8.06 0 0 1 18.92 8ZM12 4c.83 1.2 1.5 2.54 1.89 4h-3.78C10.5 6.54 11.17 5.2 12 4ZM4.26 14A7.8 7.8 0 0 1 4 12c0-.69.1-1.36.26-2h3.43a16.5 16.5 0 0 0 0 4H4.26Zm.82 2h3.03c.32 1.27.79 2.47 1.38 3.56A8.06 8.06 0 0 1 5.08 16Zm3.03-8H5.08a8.06 8.06 0 0 1 4.41-3.56A15.7 15.7 0 0 0 8.11 8ZM12 20c-.83-1.2-1.5-2.54-1.89-4h3.78c-.39 1.46-1.06 2.8-1.89 4Zm2.3-6H9.7a14.4 14.4 0 0 1 0-4h4.6a14.4 14.4 0 0 1 0 4Zm.21 5.56A15.7 15.7 0 0 0 15.89 16h3.03a8.06 8.06 0 0 1-4.41 3.56ZM16.31 14a16.5 16.5 0 0 0 0-4h3.43c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.43Z",
  };
  const path = paths[children] || paths.error;
  return <svg className="material-symbols-outlined material-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

function AstralField() {
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - .5) * 2;
      const y = (event.clientY / window.innerHeight - .5) * 2;
      field.current?.style.setProperty("--mouse-x", x.toFixed(3));
      field.current?.style.setProperty("--mouse-y", y.toFixed(3));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  const nodes = Array.from({ length: 22 }, (_, i) => ({
    x: (i * 37 + 11) % 96,
    y: (i * 53 + 7) % 82,
    depth: (i % 4) + 1,
    size: i % 7 === 0 ? 4 : i % 3 === 0 ? 3 : 2,
  }));
  return <div className="astral-field" ref={field} aria-hidden="true">
    {nodes.map((node, i) => <i key={i} style={{ "--node-x": `${node.x}%`, "--node-y": `${node.y}%`, "--depth": node.depth, "--node-size": `${node.size}px` } as React.CSSProperties} />)}
  </div>;
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return <p className="micro">{children}</p>;
}

function CoverageContent() {
  return <section className="coverage grid-section" id="coverage">
    <div className="coverage-title"><MicroLabel>WHAT {BRAND.toUpperCase()} CHECKS (AND WHAT IT DOESN'T)</MicroLabel><h2>Clear scope.<br />No false assurance.</h2></div>
    <div className="coverage-columns">
      <article><MicroLabel>WE CHECK</MicroLabel>{coverageChecks.map(item => <div key={item}><MaterialIcon>check</MaterialIcon><span>{item}</span></div>)}</article>
      <article className="coverage-muted"><MicroLabel>WE DON'T CHECK</MicroLabel>{coverageExclusions.map(item => <div key={item}><span className="coverage-x">×</span><span>{item}</span></div>)}</article>
    </div>
    <div className="coverage-callout">A clean {BRAND} scan means we didn't find these specific issues. It does not mean your app is secure. {BRAND} is not a full security audit or a penetration test.</div>
  </section>;
}

function validateScanUrl(value: string) {
  if (!value.trim()) return "Enter the public URL of the app you want to scan.";
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(parsed.protocol)) return "Use an HTTP or HTTPS link. File paths and other protocols are not supported.";
    if (!parsed.hostname.includes(".") || ["localhost", "127.0.0.1"].includes(parsed.hostname)) return "Enter a publicly deployed app. Localhost is keeping its secrets to itself.";
    return "";
  } catch {
    return "That does not look like a complete app URL. Try something like https://your-app.com.";
  }
}

function UrlForm({ compact = false, onStart, onFeedback }: { compact?: boolean; onStart: (url: string) => void; onFeedback?: (message: string) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextError = validateScanUrl(url);
    if (nextError) {
      setError(nextError);
      onFeedback?.(nextError);
      return;
    }
    setError("");
    onStart(url);
  };
  return (
    <form className={`url-form ${compact ? "compact" : ""} ${error ? "has-error" : ""}`} onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor={compact ? "closing-url" : "hero-url"}>Your app URL</label>
      <input id={compact ? "closing-url" : "hero-url"} type="url" placeholder="https://your-app.com" value={url} onChange={(e) => { setUrl(e.target.value); if (error) setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? `${compact ? "closing" : "hero"}-url-error` : undefined} />
      <button className="button primary" type="submit">Start free scan</button>
      {error && <p className="url-error" id={`${compact ? "closing" : "hero"}-url-error`}><MaterialIcon>error</MaterialIcon>{error}</p>}
    </form>
  );
}

function LayerDiagram() {
  return (
    <div className="terminal-scene" aria-label="Command line scanning a sample codebase">
      <div className="terminal-window">
        <div className="terminal-titlebar">
          <span className="terminal-dots"><i /><i /><i /></span>
          <code>leaklens — security scan</code>
          <MaterialIcon>terminal</MaterialIcon>
        </div>
        <div className="terminal-body">
          <div><span className="prompt">leaklens@scan:~$</span> leaklens scan ./acme-notes <i className="cursor" /></div>
          <div className="terminal-muted">Ownership verified · read-only mode</div>
          <div className="terminal-line line-1"><b>[01]</b> Reading frontend bundle <span>14 files</span></div>
          <div className="terminal-line line-2"><b>[02]</b> Checking Supabase policies <span>6 tables</span></div>
          <div className="terminal-line line-3"><b>[03]</b> Inspecting storage access <span>2 buckets</span></div>
          <div className="terminal-finding finding-one"><i /> CRITICAL <code>/assets/index-a81c.js</code><strong>exposed key</strong></div>
          <div className="terminal-finding finding-two"><i /> HIGH <code>public/profiles</code><strong>open table</strong></div>
          <div className="terminal-progress"><span /><code>SCANNING PUBLIC EDGE · 68%</code></div>
        </div>
      </div>
      <span className="terminal-caption">SAMPLE SCAN / NO CHANGES MADE</span>
    </div>
  );
}

function VerificationModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [method, setMethod] = useState<"dns" | "meta">("dns");
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="verify-title">
      <div className="modal">
        <div className="modal-top">
          <MicroLabel>OWNERSHIP CHECK / REQUIRED</MicroLabel>
          <button className="icon-button" onClick={onClose} aria-label="Close"><MaterialIcon>close</MaterialIcon></button>
        </div>
        <h2 id="verify-title">Verify this app is yours.</h2>
        <p>Before scanning <strong>{url}</strong>, add one temporary verification value.</p>
        <div className="tabs">
          <button className={method === "dns" ? "active" : ""} onClick={() => setMethod("dns")}>DNS TXT record</button>
          <button className={method === "meta" ? "active" : ""} onClick={() => setMethod("meta")}>Meta tag</button>
        </div>
        <div className="code-box">
          {method === "dns" ? (
            <><span>HOST</span><code>_leaklens</code><span>VALUE</span><code>leaklens-verification=ll_••••••••3a</code></>
          ) : (
            <code>&lt;meta name="leaklens-verification" content="ll_••••••••3a" /&gt;</code>
          )}
        </div>
        <button className="button primary wide" onClick={onClose}>I’ve added it — verify</button>
        <small>This prototype does not run a live scan.</small>
      </div>
    </div>
  );
}

type LegalDocument = "terms" | "privacy";

function LegalModal({ document, onClose }: { document: LegalDocument; onClose: () => void }) {
  const isTerms = document === "terms";
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-title" onMouseDown={onClose}>
    <div className="modal legal-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="modal-top"><MicroLabel>LEAKLENS / LEGAL</MicroLabel><button className="icon-button" onClick={onClose} aria-label="Close"><MaterialIcon>close</MaterialIcon></button></div>
      <h2 id="legal-title">{isTerms ? "Terms of Service" : "Privacy Policy"}</h2>
      <p className="legal-updated">PROTOTYPE COPY / LAST UPDATED 2025</p>
      <div className="legal-copy">
        {isTerms ? <>
          <section><h3>Authorised use only</h3><p>You may scan only websites you own or have explicit permission to test. Each domain and subdomain must pass ownership verification before a scan starts.</p></section>
          <section><h3>What the service does</h3><p>LeakLens performs read-only checks against publicly reachable parts of a website. It is not a penetration test, full security audit or guarantee of security.</p></section>
          <section><h3>Acceptable use</h3><p>Do not use LeakLens to inspect third-party sites, evade verification, disrupt services, access private data or attempt unauthorised testing.</p></section>
          <section><h3>Results and remediation</h3><p>Findings and fix prompts should be reviewed before use. You remain responsible for changes made to your website, infrastructure and connected services.</p></section>
          <section><h3>Prototype status</h3><p>This prototype uses sample data and simulated scans. It does not create an account, contact a live target or provide production security services.</p></section>
        </> : <>
          <section><h3>Prototype data</h3><p>This prototype keeps form values only in the current browser session. It does not send credentials, website URLs or scan data to a backend.</p></section>
          <section><h3>Ownership verification</h3><p>DNS records, meta tags and verification files shown here are simulated examples and are not checked against a live domain.</p></section>
          <section><h3>Sample reports</h3><p>Apps, findings, scores, evidence and account information displayed in this prototype are clearly labelled sample data.</p></section>
          <section><h3>A production service</h3><p>A live version would document the data it collects, retention periods, processors, security controls and deletion options before accepting real scans.</p></section>
        </>}
      </div>
      <button className="button primary wide" onClick={onClose}>Close</button>
    </div>
  </div>;
}

function Marketing({ onEnter, onLogin }: { onEnter: (url: string) => void; onLogin: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [siteType, setSiteType] = useState<"ai" | "any">("ai");
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [botMessage, setBotMessage] = useState("Give me a deployed URL. I’ll look for the things your launch sprint politely ignored.");

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const nodes = document.querySelectorAll(".grid-section, .blue-band, .chart-card, .safety-cards article, .finding-card");
    nodes.forEach(node => node.classList.add("reveal-target"));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    nodes.forEach(node => observer.observe(node));
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  const beginScan = (url: string) => onEnter(url.replace(/^https?:\/\//, ""));
  const closeMenu = () => setMenuOpen(false);
  const copyPrompt = async () => {
    await navigator.clipboard?.writeText("In Supabase, rotate this exposed key and move it to a server-side environment variable. Remove it from the client bundle, then redeploy.");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main>
      <header className={`topbar ${navScrolled ? "scrolled" : ""}`}>
        <a className="wordmark" href="#top" onClick={closeMenu}>{BRAND}<sup>®</sup></a>
        <button className="menu-toggle" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
          <MaterialIcon>{menuOpen ? "close" : "menu"}</MaterialIcon>
        </button>
        <nav className={menuOpen ? "open" : ""}>
          <a href="#findings" onClick={closeMenu}>What we find</a>
          <a href="#coverage" onClick={closeMenu}>Coverage</a>
          <a href="#how" onClick={closeMenu}>How it works</a>
          <a href="#safety" onClick={closeMenu}>Safety</a>
          <a href="#faq" onClick={closeMenu}>FAQ</a>
          <button className="nav-login" onClick={onLogin}>Log in</button>
          <a className="button primary nav-cta" href="#scan" onClick={closeMenu}>Scan my app</a>
        </nav>
      </header>

      <section className="hero grid-section" id="top">
        <AstralField />
        <div className="cross cross-tl" /><div className="cross cross-tr" />
        <MicroLabel>PUBLIC EXPOSURE CHECKS / 2025</MicroLabel>
        <h1>Find what your website left open.</h1>
        <p className="hero-copy">{BRAND} checks apps built with Lovable, Bolt, Cursor and v0, and any other website you own, for leaked keys and open databases. Then it gives you the fix in plain English.</p>
        <div className="hero-scope">
          <div className="app-tabs" role="tablist" aria-label="Choose site type">
            <button className={siteType === "ai" ? "active" : ""} role="tab" aria-selected={siteType === "ai"} onClick={() => setSiteType("ai")}>AI-built app</button>
            <button className={siteType === "any" ? "active" : ""} role="tab" aria-selected={siteType === "any"} onClick={() => setSiteType("any")}>Any website</button>
          </div>
          <p>{siteType === "ai" ? "Lovable, Bolt, Cursor, v0, or another AI builder." : "Any publicly reachable website is supported, regardless of how it was built."}</p>
        </div>
        <UrlForm onStart={beginScan} onFeedback={setBotMessage} />
        <p className="helper">You must prove you own or are authorised to scan the site. LeakLens will not scan unverified domains.</p>
        <p className="scan-consent">By starting a scan, you confirm you’re authorised and agree to the <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and acknowledge the <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.</p>
        <LayerDiagram />
      </section>

      <section className="stats grid-section">
        <div><strong>3 min</strong><span>Typical scan time</span></div>
        <div><strong>0</strong><span>Changes made to your app</span></div>
      </section>

      <section className="checks grid-section" id="findings">
        <div className="section-intro">
          <MicroLabel>01 / WHAT WE CHECK</MicroLabel>
          <h2>You shipped fast.<br />Your keys shipped too.</h2>
          <p>AI builders make it possible to go from idea to deployed app in a weekend. They can also make it easy to put sensitive things in public places.</p>
        </div>
        <div className="checklist">
          {checks.map((check, i) => <div key={check}><span>{String(i + 1).padStart(2, "0")}</span><p>{check}</p><b>CHECK</b></div>)}
        </div>
      </section>

      <section className="blue-band">
        <div className="blue-inner">
          <div className="blue-heading">
            <MicroLabel>02 / SIGNAL, NOT NOISE</MicroLabel>
            <h2>What we find.</h2>
            <p>Focused checks for the mistakes that matter most in public, AI-built apps.</p>
          </div>
          <div className="charts" aria-label="Illustrative findings charts">
            {[["KEYS", 54], ["TABLES", 78], ["BUCKETS", 36]].map(([label, value], card) => (
              <div className="chart-card" key={label}>
                <div className="chart-head"><span>{label}</span><small>ILLUSTRATIVE</small></div>
                <div className="bars">{[.38, .7, .48, 1, .62, .82, .34].map((v, i) => <i key={i} style={{ height: `${Number(value) * v}%` }} />)}</div>
                <span className="chart-index">0{card + 1}</span>
              </div>
            ))}
          </div>
          <div className="blue-notes">
            <article><MicroLabel>HOW WE CHECK</MicroLabel><h3>From the outside, like a visitor.</h3><p>We inspect only what your deployed app exposes publicly. No admin credentials, no private source code.</p></article>
            <article><MicroLabel>WHAT WE NEVER TOUCH</MicroLabel><h3>Your data stays where it is.</h3><p>We don’t write to tables, download user files, exploit vulnerabilities or make changes to your app.</p></article>
          </div>
        </div>
      </section>

      <CoverageContent />

      <section className="process grid-section" id="how">
        <div className="process-copy">
          <MicroLabel>03 / HOW IT WORKS</MicroLabel>
          <h2>Three steps, five minutes of your time.</h2>
          <div className="step-list">
            {steps.map((step, i) => (
              <button className={activeStep === i ? "active" : ""} key={step.title} onClick={() => setActiveStep(i)} aria-expanded={activeStep === i}>
                <span>{step.number}</span><strong>{step.title}</strong><i><MaterialIcon>{activeStep === i ? "remove" : "add"}</MaterialIcon></i>
                {activeStep === i && <p>{step.body}</p>}
              </button>
            ))}
          </div>
        </div>
        <div className="card-stack" aria-label={`${steps[activeStep].title} step illustration`}>
          <div className="stack-card back-two" /><div className="stack-card back-one" />
          <div className="stack-card front">
            <MicroLabel>STEP {steps[activeStep].number} / {steps[activeStep].title.toUpperCase()}</MicroLabel>
            <div className="mini-browser"><span /><span /><span /><b>your-app.com</b></div>
            <div className="mini-status"><i />{activeStep === 0 ? "Awaiting verification" : activeStep === 1 ? "Read-only scan running" : "Fix prompt ready"}</div>
            <div className="mini-lines"><i /><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="sample grid-section">
        <div className="frame-label"><MicroLabel>SAMPLE FINDING / 01</MicroLabel><span>CLIENT BUNDLE</span></div>
        <article className="finding-card">
          <div className="finding-top"><span className="severity">CRITICAL</span><span>LL-KEY-001</span></div>
          <h2>A live API key is visible in your frontend.</h2>
          <p>Anyone who opens your app can read this key. If it has write access, they may be able to use the service as if they were you.</p>
          <div className="masked-key"><span>FOUND IN /assets/index-a81c.js</span><code>sk_live_••••••••••••4Kp2</code></div>
          <button className="button primary" onClick={copyPrompt}>{copied ? "Copied" : "Copy fix prompt"} <Arrow /></button>
        </article>
      </section>

      <section className="safety grid-section" id="safety">
        <div className="section-title"><MicroLabel>04 / SAFETY BY DESIGN</MicroLabel><h2>Clear boundaries.<br />No surprises.</h2></div>
        <div className="safety-cards">
          <article><span>01</span><div className="line-icon shield" /><h3>Only apps you own</h3><p>A scan starts only after you prove ownership with a DNS record or meta tag.</p></article>
          <article><span>02</span><div className="line-icon eye" /><h3>Read-only, never exploits</h3><p>We observe public behavior. We never alter data, escalate access or test destructive paths.</p></article>
        </div>
      </section>

      <section className="builders grid-section">
        <MicroLabel>WORKS WITH</MicroLabel>
        <div className="chips">{builderBrands.map(brand => <span key={brand.name}><img src={brand.logo} alt="" />{brand.name}</span>)}<span><MaterialIcon>language</MaterialIcon>Any website you own</span></div>
      </section>

      <section className="faq grid-section" id="faq">
        <div><MicroLabel>05 / FAQ</MicroLabel><h2>The questions worth asking.</h2></div>
        <div className="faq-list">
          {faqs.map(([q, a], i) => (
            <button key={q} onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
              <span>{q}</span><i><MaterialIcon>{openFaq === i ? "remove" : "add"}</MaterialIcon></i>
              {openFaq === i && <p>{a}</p>}
            </button>
          ))}
        </div>
      </section>

      <section className="closing grid-section" id="scan">
        <MicroLabel>YOUR APP / YOUR CALL</MicroLabel>
        <h2>Check your app before someone else does.</h2>
        <UrlForm compact onStart={beginScan} onFeedback={setBotMessage} />
        <p className="helper">Read-only scan. Ownership verification required.</p>
        <p className="scan-consent">By starting a scan, you agree to the <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and acknowledge the <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.</p>
      </section>

      <footer>
        <div className="footer-grid">
          <div><a className="wordmark" href="#top">{BRAND}<sup>®</sup></a><p>Plain-English security checks for apps built with AI.</p></div>
          <div><MicroLabel>EXPLORE</MicroLabel><a href="#how">How it works</a><a href="#findings">What we find</a><a href="#coverage">Coverage</a><a href="#safety">Safety</a></div>
          <div><MicroLabel>SUPPORT</MicroLabel><a href="#faq">FAQ</a><a href="#scan">Start a scan</a><button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button><button onClick={() => setLegalDocument("terms")}>Terms of Service</button></div>
          <div><MicroLabel>STATUS</MicroLabel><p><i className="status-dot" /> All systems operational</p></div>
        </div>
        <div className="footer-mark">{BRAND}</div>
        <div className="legal"><span>© 2025 {BRAND}</span><span>WORKING NAME / PROTOTYPE</span></div>
      </footer>
      <Companion message={botMessage} />
      {legalDocument && <LegalModal document={legalDocument} onClose={() => setLegalDocument(null)} />}

    </main>
  );
}

type AuthMode = "login" | "signup" | "forgot";

function AuthScreen({ mode, onMode, onSuccess, onBack }: { mode: AuthMode; onMode: (mode: AuthMode) => void; onSuccess: () => void; onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [botMessage, setBotMessage] = useState("Any properly formatted sample credentials work. Security theatre, but useful security theatre.");
  useEffect(() => {
    setSent(false);
    setError("");
    setBotMessage(mode === "forgot"
      ? "Forgotten passwords happen. Usually five seconds after creating them."
      : mode === "signup"
        ? "A sample account for a sample app. Very tidy."
        : "Welcome back. Assuming the password agrees.");
  }, [mode]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a complete email address, including the part after the dot.");
      setBotMessage("That email is missing a few structural components. I checked twice.");
      return;
    }
    if (mode !== "forgot" && password.length < 6) {
      setError("Use at least 6 characters for this simulated password.");
      setBotMessage("Six characters. A low bar, yet here we are.");
      return;
    }
    if (mode === "login" && password.toLowerCase() === "wrong") {
      setError("That sample password was rejected. Try anything except “wrong”.");
      setBotMessage("You entered “wrong” as the password. Admirably honest, technically ineffective.");
      return;
    }
    setError("");
    if (mode === "forgot") {
      setSent(true);
      setBotMessage("Reset link dispatched to the imaginary inbox. Delivery is spectacularly fast there.");
    } else onSuccess();
  };
  return <main className="auth-page">
    <AstralField />
    <header className="auth-top"><button className="wordmark" onClick={onBack}>{BRAND}<sup>®</sup></button><MicroLabel>SIMULATED AUTHENTICATION</MicroLabel></header>
    <section className="auth-card">
      <button className="app-back" onClick={onBack}><MaterialIcon>arrow_back</MaterialIcon> BACK</button>
      <MicroLabel>{mode === "login" ? "WELCOME BACK" : mode === "signup" ? "CREATE SAMPLE ACCOUNT" : "RESET ACCESS"}</MicroLabel>
      <h1>{mode === "login" ? "Log in." : mode === "signup" ? "Start scanning." : "Forgot your password?"}</h1>
      <p>{mode === "forgot" ? "Enter any valid email to simulate receiving a reset link." : "This prototype accepts any correctly formatted sample credentials."}</p>
      {sent ? <div className="auth-sent"><MaterialIcon>mark_email_read</MaterialIcon><h2>Check your pretend inbox.</h2><p>A simulated reset link is on its entirely fictional way.</p><button className="button primary" onClick={() => onMode("login")}>Return to login</button></div> :
      <form onSubmit={submit} noValidate>
        {mode === "signup" && <label>NAME<input name="name" required minLength={2} placeholder="Alex Morgan" /></label>}
        <label>EMAIL<input name="email" required type="email" placeholder="you@example.com" onChange={() => setError("")} /></label>
        {mode !== "forgot" && <label>PASSWORD<input name="password" required type="password" minLength={6} placeholder="At least 6 characters" onChange={() => setError("")} /></label>}
        {error && <p className="field-error"><MaterialIcon>error</MaterialIcon>{error}</p>}
        <button className="button primary" type="submit">{mode === "login" ? "Log in" : mode === "signup" ? "Create sample account" : "Send reset link"}</button>
      </form>}
      {!sent && <div className="auth-switch">
        {mode === "login" && <><button onClick={() => onMode("forgot")}>Forgot password?</button><button onClick={() => onMode("signup")}>Create an account</button></>}
        {mode === "signup" && <button onClick={() => onMode("login")}>Already have an account? Log in</button>}
        {mode === "forgot" && <button onClick={() => onMode("login")}>Remembered it? Log in</button>}
      </div>}
      <small>No account is created and no credentials are stored in this prototype.</small>
    </section>
    <Companion message={botMessage} />
  </main>;
}

type Screen = "new" | "verify" | "progress" | "results" | "history" | "apps" | "compare" | "settings" | "failed";
type Severity = "Critical" | "High" | "Medium" | "Low";
type Finding = {
  id: number; severity: Severity; title: string; where: string; status: "Open" | "Fixed" | "Ignored";
  meaning: string; why: string; evidence: string; steps: string[];
};

const sampleFindings: Finding[] = [
  { id: 1, severity: "Critical", title: "Live secret key exposed in main bundle", where: "/assets/index-a81c.js", status: "Open", meaning: "A private service key was included in code sent to every visitor’s browser.", why: "Someone could copy it and use the connected service as if they were you.", evidence: "sk_live_••••••••••••8f2a", steps: ["Rotate the exposed key in the service dashboard.", "Move the replacement key to a server-side environment variable.", "Remove the key from client code and redeploy." ] },
  { id: 2, severity: "High", title: "Table “profiles” readable by anonymous users", where: "supabase/public/profiles", status: "Open", meaning: "Anyone can query every row in the profiles table without signing in.", why: "Private profile information may be visible outside your app.", evidence: "GET /rest/v1/profiles → 200 anon", steps: ["Enable row-level security on profiles.", "Add a SELECT policy limited to the signed-in user.", "Test the table with an anonymous request."] },
  { id: 3, severity: "High", title: "Public storage bucket “uploads”", where: "storage/uploads", status: "Open", meaning: "Files in uploads can be listed and downloaded without authentication.", why: "User uploads may be discoverable by anyone who knows the bucket name.", evidence: "bucket: uploads / public: true", steps: ["Set the uploads bucket to private.", "Add a policy for file owners.", "Use signed URLs when displaying files."] },
  { id: 4, severity: "Critical", title: "Environment file is publicly reachable", where: "/.env", status: "Fixed", meaning: "Your deployed server returns the environment file over the public web.", why: "Environment files often contain credentials that unlock other services.", evidence: "GET /.env → 200 / KEY=••••", steps: ["Block dotfiles at the web server.", "Remove .env from the deployment output.", "Rotate every secret that was present."] },
  { id: 5, severity: "High", title: "Row-level security missing on “orders”", where: "supabase/public/orders", status: "Open", meaning: "The orders table does not enforce per-user access rules.", why: "A client with the public key may read or change other customers’ orders.", evidence: "orders.relrowsecurity = false", steps: ["Enable row-level security on orders.", "Add policies for SELECT, INSERT and UPDATE.", "Confirm anonymous requests are denied."] },
  { id: 6, severity: "Medium", title: "Service URL reveals internal project ID", where: "/src/lib/supabase.ts", status: "Ignored", meaning: "Your public bundle exposes the project identifier used by your database client.", why: "It gives an attacker useful context when combined with another configuration mistake.", evidence: "https://•••••.supabase.co", steps: ["Review whether this identifier is expected to be public.", "Remove debug configuration from the production bundle.", "Rescan after deploying."] },
  { id: 7, severity: "Medium", title: "Source map available in production", where: "/assets/index.js.map", status: "Open", meaning: "The browser can download a map of your original source files.", why: "Readable source makes exposed keys and application logic easier to locate.", evidence: "GET /assets/index.js.map → 200", steps: ["Disable production source maps.", "Delete existing .map files from hosting.", "Redeploy the app."] },
  { id: 8, severity: "Low", title: "Verbose API error response", where: "/api/profile", status: "Open", meaning: "An API response includes implementation details intended for developers.", why: "Detailed errors make it easier to understand your internal setup.", evidence: "error: relation public.profiles", steps: ["Return a generic error to the client.", "Keep detailed errors in server logs only.", "Test the production response."] },
  { id: 9, severity: "Low", title: "Storage path can be enumerated", where: "storage/avatars", status: "Fixed", meaning: "Predictable avatar paths reveal whether a file exists.", why: "This can disclose which users have uploaded an avatar.", evidence: "/avatars/user_••••.png", steps: ["Use unguessable object names.", "Require signed URLs.", "Return the same response for missing objects."] },
];

const scanSteps = ["Fetching app", "Reading bundle", "Checking Supabase", "Checking storage", "Building report"];
const scanMessages = ["Connecting to the deployed app", "Reading 14 public frontend assets", "Checking 6 public tables", "Reviewing 2 storage buckets", "Prioritising findings in plain English"];
const checksRun = [
  ["Public JavaScript secrets", "Issue found", ""],
  ["Supabase anonymous access", "Issue found", ""],
  ["Row-level security", "Issue found", ""],
  ["Public storage buckets", "Issue found", ""],
  ["Reachable sensitive files", "Passed", ""],
  ["Firebase database rules", "Not applicable", "Firebase not detected"],
  ["CORS configuration", "Couldn't test", "API did not return CORS headers"],
];
const severityClass = (severity: string) => `sev-${severity.toLowerCase()}`;

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return <div className="app-code"><code>{value}</code><button onClick={copy}>{copied ? "COPIED" : "COPY"}</button></div>;
}

function ScoreCount({ target }: { target: number }) {
  const [score, setScore] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      setScore(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <>{score}</>;
}

function Companion({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  return <div className={`companion ${open ? "open" : ""}`}>
    {open && <div className="companion-note"><button onClick={() => setOpen(false)} aria-label="Dismiss"><MaterialIcon>close</MaterialIcon></button><p>{message}</p></div>}
    <button className="companion-bot" onClick={() => setOpen(!open)} aria-label="Toggle LeakLens companion"><MaterialIcon>smart_toy</MaterialIcon><i /></button>
  </div>;
}

function FindingDrawer({ finding, onClose, onStatus }: { finding: Finding; onClose: () => void; onStatus: (status: Finding["status"]) => void }) {
  const [builder, setBuilder] = useState("Lovable");
  const [fixMode, setFixMode] = useState<"manual" | "agent">("manual");
  const promptLead: Record<string, string> = {
    Lovable: "Update this Lovable project and apply the following security fix without changing the current UI:",
    Bolt: "In this Bolt app, make the smallest scoped code and configuration changes required to:",
    Cursor: "Inspect the relevant files in this Cursor workspace, then implement and verify this fix:",
    v0: "Update the server-side implementation for this v0 app. Do not expose secrets to client components:",
    "Any agent": "Inspect this project and apply the following security fix using the project's existing framework and conventions:",
  };
  const prompt = `${promptLead[builder]} ${finding.title} at ${finding.where}. ${finding.steps.join(" ")} Preserve unrelated behavior and summarize the files changed.`;
  return <div className="drawer-scrim" onMouseDown={onClose}>
    <aside className="finding-drawer" onMouseDown={(e) => e.stopPropagation()}>
      <div className="drawer-head"><span className={`app-badge ${severityClass(finding.severity)}`}>{finding.severity}</span><button onClick={onClose}>CLOSE <MaterialIcon>close</MaterialIcon></button></div>
      <h2>{finding.title}</h2>
      <section><MicroLabel>WHAT THIS MEANS</MicroLabel><p>{finding.meaning}</p></section>
      <section><MicroLabel>WHY IT MATTERS</MicroLabel><p>{finding.why}</p></section>
      <div className={`risk-callout ${severityClass(finding.severity)}`}><MaterialIcon>crisis_alert</MaterialIcon><div><MicroLabel>WHY YOU SHOULD FIX THIS</MicroLabel><p>{finding.severity === "Critical" ? "Treat this as immediate: rotate exposed credentials before changing code, because copied secrets stay copied." : finding.severity === "High" ? "Fix this before the next release. Public access can turn a small configuration mistake into someone else’s data." : "Schedule this fix soon. It reduces useful information and attack paths before they combine with a larger issue."}</p></div></div>
      <section><MicroLabel>EVIDENCE / SAMPLE DATA</MicroLabel><CopyBlock value={finding.evidence} /></section>
      <div className="fix-choice"><button className={fixMode === "manual" ? "active" : ""} onClick={() => setFixMode("manual")}><MaterialIcon>construction</MaterialIcon><span>Fix it yourself<small>Technical, best-practice steps</small></span></button><button className={fixMode === "agent" ? "active" : ""} onClick={() => setFixMode("agent")}><MaterialIcon>auto_awesome</MaterialIcon><span>Give it to your agent<small>Ready-to-paste fix prompt</small></span></button></div>
      {fixMode === "manual" ? <section className="manual-fix"><MicroLabel>TECHNICAL RESOLUTION / INDUSTRY PRACTICE</MicroLabel><ol>{finding.steps.map((step, i) => <li key={step}><span>0{i + 1}</span>{step}</li>)}</ol><p><MaterialIcon>verified_user</MaterialIcon> Rotate compromised credentials first, apply least privilege, then verify with a clean rescan.</p></section> :
      <section className="prompt-panel">
          <MicroLabel>COPY FIX PROMPT FOR YOUR AI BUILDER</MicroLabel>
          <div className="app-tabs">{["Lovable", "Bolt", "Cursor", "v0", "Any agent"].map(x => <button className={builder === x ? "active" : ""} onClick={() => setBuilder(x)} key={x}>{x}</button>)}</div>
          <CopyBlock value={prompt} />
        </section>}
      <label className="status-control">STATUS<select value={finding.status} onChange={(e) => onStatus(e.target.value as Finding["status"])}><option>Open</option><option>Fixed</option><option>Ignored</option></select></label>
      {finding.status === "Fixed" && <p className="status-note">Marked fixed. A rescan is required to confirm the issue is resolved.</p>}
    </aside>
  </div>;
}

function LoggedInApp({ initialUrl, onExit }: { initialUrl: string; onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("new");
  const [url, setUrl] = useState(initialUrl);
  const [builder, setBuilder] = useState("Lovable");
  const [verifyTab, setVerifyTab] = useState("dns");
  const [verifyStatus, setVerifyStatus] = useState<"Waiting" | "Checking" | "Verified" | "Failed">("Waiting");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [findings, setFindings] = useState(sampleFindings);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [accountOpen, setAccountOpen] = useState(false);
  const [cleanReport, setCleanReport] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [urlError, setUrlError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const filtered = findings.filter(f => (severityFilter === "All" || f.severity === severityFilter) && (statusFilter === "All" || f.status === statusFilter));
  const fixedCount = findings.filter(f => f.status === "Fixed").length;
  const securityScore = 62 + Math.max(0, fixedCount - 2) * 4;
  const companionMessage = actionMessage || (cleanReport && screen === "results"
    ? "No findings. Suspiciously responsible. Nice work."
    : screen === "new" ? "A URL first. Telepathy is still in beta."
    : screen === "verify" && verifyStatus === "Failed" ? "DNS is taking the scenic route. Try again in a moment."
    : screen === "progress" ? "You can stop staring at the progress bar. I’ve got this."
    : screen === "results" ? "Two critical findings. Your app has character."
    : screen === "settings" ? "The danger zone is accurately named. Refreshing."
    : "I watch the public edges. Quietly, mostly.");

  useEffect(() => {
    if (screen !== "progress") return;
    setProgress(0); setElapsed(0);
    const timer = window.setInterval(() => {
      setElapsed(e => e + 1);
      setProgress(p => {
        if (p >= scanSteps.length) { clearInterval(timer); window.setTimeout(() => setScreen("results"), 450); return p; }
        return p + 1;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [screen]);

  const verify = () => {
    setVerifyStatus("Checking");
    window.setTimeout(() => setVerifyStatus("Verified"), 700);
  };
  const nav = (next: Screen) => { setScreen(next); setSelected(null); };
  const continueToVerification = () => {
    const nextError = validateScanUrl(url);
    if (nextError) {
      setUrlError(nextError);
      setActionMessage(nextError);
      return;
    }
    if (!authorized) {
      setUrlError("Confirm that you own this site or are authorised to scan it.");
      setActionMessage("Ownership first. Even simulated scanners need boundaries.");
      return;
    }
    setUrlError("");
    setActionMessage("");
    nav("verify");
  };
  const updateStatus = (status: Finding["status"]) => {
    setFindings(items => items.map(f => f.id === selected?.id ? { ...f, status } : f));
    if (selected) setSelected({ ...selected, status });
  };

  return <div className="app-shell">
    <aside className="app-sidebar">
      <button className="app-logo" onClick={onExit}>{BRAND}<sup>®</sup></button>
      <button className="sidebar-new" onClick={() => nav("new")}><MaterialIcon>add</MaterialIcon> New scan</button>
      <nav>
        <button className={["history","results","compare","failed"].includes(screen) ? "active" : ""} onClick={() => nav("history")}><MaterialIcon>radar</MaterialIcon>Scans</button>
        <button onClick={() => nav("apps")} className={screen === "apps" ? "active" : ""}><MaterialIcon>apps</MaterialIcon>Apps</button>
        <button onClick={() => nav("settings")} className={screen === "settings" ? "active" : ""}><MaterialIcon>settings</MaterialIcon>Settings</button>
      </nav>
      <div className="sample-label">SAMPLE WORKSPACE<br />ALL DATA IS SAMPLE</div>
    </aside>
    <div className="app-main">
      <header className="app-topbar">
        <button className="app-switcher"><span>LL</span><b>Acme Notes</b><MaterialIcon>expand_more</MaterialIcon></button>
        <div className="account-wrap"><button className="account-button" onClick={() => setAccountOpen(!accountOpen)}><span>AM</span>Alex Morgan <MaterialIcon>expand_more</MaterialIcon></button>
          {accountOpen && <div className="account-menu"><button onClick={() => nav("settings")}>Account settings</button><button onClick={onExit}>Log out</button></div>}
        </div>
      </header>
      <div className="app-content">
        <div className="screen-transition" key={screen}>
        {screen === "new" && <section className="app-screen">
          <div className="app-page-title"><MicroLabel>NEW SCAN / SAMPLE WORKSPACE</MicroLabel><h1>What should we check?</h1><p>Choose your deployed app and the read-only checks to run.</p></div>
          <div className="app-form-card">
            <label>APP URL<input value={url} onChange={e => { setUrl(e.target.value); setUrlError(""); setActionMessage(""); }} placeholder="https://your-app.com" aria-invalid={Boolean(urlError)} />{urlError && <p className="field-error"><MaterialIcon>error</MaterialIcon>{urlError}</p>}</label>
            <fieldset><legend>BUILDER</legend><div className="builder-select">{["Lovable","Bolt","Cursor","v0","Other / not sure"].map(x => <button className={builder === x ? "active" : ""} onClick={() => setBuilder(x)} key={x}>{x}</button>)}</div><p className="field-helper">Built by hand or not sure? Choose Other. We detect issues from what your site exposes, not from the builder.</p></fieldset>
            <fieldset><legend>CHECKS</legend><div className="app-checks">{checks.map(x => <label key={x}><input type="checkbox" defaultChecked /> <span>{x}</span></label>)}</div><a className="coverage-link" href="/#coverage">What we check and don't check</a></fieldset>
            <label className="ownership-check"><input type="checkbox" checked={authorized} onChange={e => { setAuthorized(e.target.checked); setUrlError(""); }} />I own this site, or I'm authorised to scan it.</label>
            <button className="button primary app-action" onClick={continueToVerification}>Continue to verification <Arrow /></button>
            <p className="scan-consent app-consent">By continuing, you agree to the <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and acknowledge the <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.</p>
          </div>
          <div className="empty-state"><MicroLabel>NO OTHER DRAFTS</MicroLabel><p>Every new scan will appear here until you start it.</p><button onClick={() => document.querySelector<HTMLInputElement>(".app-form-card input")?.focus()}>Enter an app URL</button></div>
        </section>}

        {screen === "verify" && <section className="app-screen narrow-screen">
          <button className="app-back" onClick={() => nav("new")}><MaterialIcon>arrow_back</MaterialIcon> BACK TO SCAN</button>
          <div className="app-page-title"><MicroLabel>OWNERSHIP / REQUIRED</MicroLabel><h1>Verify {url || "your app"}.</h1><p>We ask for proof so LeakLens only scans apps you own.</p></div>
          <div className="verify-card">
            <div className="app-tabs"><button className={verifyTab === "dns" ? "active" : ""} onClick={() => setVerifyTab("dns")}>DNS TXT record</button><button className={verifyTab === "meta" ? "active" : ""} onClick={() => setVerifyTab("meta")}>HTML meta tag</button><button className={verifyTab === "file" ? "active" : ""} onClick={() => setVerifyTab("file")}>Verification file</button></div>
            <p>{verifyTab === "dns" ? "Add this TXT record to your domain, then return here." : verifyTab === "meta" ? "Add this tag inside the <head> of your deployed app." : "Create this public file with the exact contents shown below."}</p>
            <CopyBlock value={verifyTab === "dns" ? "leaklens-verification=ll_sample_3a82" : verifyTab === "meta" ? '<meta name="leaklens-verification" content="ll_sample_3a82" />' : "/.well-known/leaklens.txt\nleaklens-verification=ll_sample_3a82"} />
            <p className="verify-note">Each domain and subdomain is verified separately.</p>
            <div className={`live-status status-${verifyStatus.toLowerCase()}`}><i /><div><MicroLabel>LIVE STATUS</MicroLabel><strong>{verifyStatus}</strong>{verifyStatus === "Failed" && <p>We could not find the verification value yet.</p>}</div></div>
            {verifyStatus === "Verified" ? <button className="button primary app-action" onClick={() => nav("progress")}>Start read-only scan <Arrow /></button> : <button className="button primary app-action" onClick={verify}>Verify now <Arrow /></button>}
            <p className="scan-consent app-consent">Starting a scan confirms your authorisation and acceptance of the <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.</p>
            <button className="text-action" onClick={() => setVerifyStatus("Failed")}>Preview failed verification</button>
          </div>
        </section>}

        {screen === "progress" && <section className="app-screen narrow-screen">
          <div className="app-page-title"><MicroLabel>SCAN LL-2025-031 / RUNNING</MicroLabel><h1>Looking at the public edges.</h1><p>You can leave this page. No changes are being made.</p></div>
          <div className="progress-card">
            <div className="progress-meta"><span>ELAPSED <b>00:{String(elapsed).padStart(2,"0")}</b></span><span>{Math.min(progress, 5)} / 5 CHECKS</span></div>
            <div className="progress-rule"><i style={{ width: `${Math.min(progress / 5 * 100, 100)}%` }} /></div>
            <div className="scan-stepper">{scanSteps.map((step, i) => <div className={i < progress ? "done" : i === progress ? "current" : ""} key={step}><i>{i < progress ? <MaterialIcon>check</MaterialIcon> : String(i + 1).padStart(2,"0")}</i><strong>{step}<small>{i === progress ? scanMessages[i] : ""}</small></strong><span>{i < progress ? "Complete" : i === progress ? "Checking" : "Waiting"}</span></div>)}</div>
            <button className="text-action" onClick={() => nav("failed")}>Preview failed scan</button>
          </div>
        </section>}

        {screen === "failed" && <section className="app-screen narrow-screen"><div className="app-page-title"><MicroLabel>SCAN FAILED / SAMPLE STATE</MicroLabel><h1>We lost the connection.</h1><p>The scan stopped before any checks completed. Your app was not changed.</p></div><div className="error-state"><span>!</span><p>We couldn’t reach the app long enough to finish this scan.</p><button className="button primary" onClick={() => nav("progress")}>Try the scan again</button></div></section>}

        {screen === "results" && <section className="app-screen">
          {cleanReport ? <div className="clean-report">
            <div className="clean-score"><MicroLabel>EXPOSURE SCORE / SAMPLE DATA</MicroLabel><h1><ScoreCount target={100} /><sup>/100</sup></h1><h2>No issues found in the checks we ran.</h2><p>Based only on the checks listed below. Not a full security audit.</p><a href="/#coverage">See what we don't check</a></div>
            <div className="detected-stack"><MicroLabel>DETECTED AUTOMATICALLY</MicroLabel><span>Supabase</span><span>Vite</span><span>Vercel</span></div>
            <div className="checks-run"><MicroLabel>CHECKS RUN</MicroLabel>{checksRun.map(([name,status,reason]) => { const cleanStatus = status === "Issue found" ? "Passed" : status; return <div key={name}><span>{name}{reason && <small>{reason}</small>}</span><b className={`check-status ${cleanStatus.toLowerCase().replaceAll(" ","-").replace("'","")}`}>{cleanStatus}</b></div>; })}</div>
            <div className="polish-grid"><article><MaterialIcon>palette</MaterialIcon><MicroLabel>UI POLISH</MicroLabel><h3>Clarify destructive actions</h3><p>Add confirmation and undo states anywhere a user can permanently remove data.</p></article><article><MaterialIcon>account_tree</MaterialIcon><MicroLabel>ARCHITECTURE POLISH</MicroLabel><h3>Separate privileged work</h3><p>Keep admin operations behind server-only boundaries and log sensitive actions.</p></article><article><MaterialIcon>speed</MaterialIcon><MicroLabel>PERFORMANCE POLISH</MicroLabel><h3>Measure the slow path</h3><p>Add real-user monitoring before optimising whatever currently feels suspicious.</p></article></div>
            <button className="button" onClick={() => setCleanReport(false)}>View sample findings</button>
            <p className="report-disclaimer">{BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a guarantee of security.</p>
          </div> : <>
          <div className="results-hero"><div><MicroLabel>EXPOSURE SCORE / SAMPLE DATA</MicroLabel><h1><span className="count-score"><ScoreCount target={securityScore} /></span><sup>/100</sup></h1><p>Needs attention</p><small>Based only on the checks listed below. Not a full security audit.</small><button className="review-critical" onClick={() => { setSeverityFilter("Critical"); document.querySelector(".findings-table")?.scrollIntoView({ behavior: "smooth" }); }}>Review critical findings <MaterialIcon>arrow_downward</MaterialIcon></button></div><div className="severity-summary">{["Critical","High","Medium","Low"].map(s => <div key={s}><i className={severityClass(s)} /><strong>{findings.filter(f => f.severity === s).length}</strong><span>{s}</span></div>)}</div></div>
          <div className="scan-meta"><span>SCAN ID <b>LL-2025-031</b></span><span>APP <b>{url || "acme-notes.app"}</b></span><span>BUILDER <b>{builder}</b></span><span>FINISHED <b>JUST NOW</b></span><button onClick={() => nav("compare")}>COMPARE RESCAN <MaterialIcon>arrow_forward</MaterialIcon></button></div>
          <div className="detected-stack"><MicroLabel>DETECTED AUTOMATICALLY</MicroLabel><span>Supabase</span><span>Vite</span><span>Vercel</span></div>
          <button className="clean-preview" onClick={() => setCleanReport(true)}>Preview a clean report</button>
          <div className="checks-run"><div className="checks-run-head"><MicroLabel>CHECKS RUN</MicroLabel><a href="/#coverage">View coverage</a></div>{checksRun.map(([name,status,reason]) => <div key={name}><span>{name}{reason && <small>{reason}</small>}</span><b className={`check-status ${status.toLowerCase().replaceAll(" ","-").replace("'","")}`}>{status}</b></div>)}</div>
          <div className="table-toolbar"><div><button className={severityFilter === "All" ? "active" : ""} onClick={() => setSeverityFilter("All")}>All severities</button>{["Critical","High","Medium","Low"].map(x => <button onClick={() => setSeverityFilter(x)} key={x}>{x}</button>)}</div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All</option><option>Open</option><option>Fixed</option><option>Ignored</option></select></div>
          {filtered.length ? <div className="findings-table"><div className="table-row table-head"><span>Severity</span><span>Finding</span><span>Where</span><span>Status</span></div>{filtered.map(f => <button className="table-row" onClick={() => setSelected(f)} key={f.id}><span><i className={`severity-dot ${severityClass(f.severity)}`} />{f.severity}</span><strong>{f.title}</strong><code>{f.where}</code><span>{f.status} <MaterialIcon>chevron_right</MaterialIcon></span></button>)}</div> : <div className="empty-state"><MicroLabel>NO MATCHES</MicroLabel><p>No sample findings match these filters.</p><button onClick={() => {setSeverityFilter("All");setStatusFilter("All");}}>Clear filters</button></div>}
          <p className="report-disclaimer">{BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a guarantee of security.</p>
          </>}
        </section>}

        {screen === "compare" && <section className="app-screen">
          <button className="app-back" onClick={() => nav("results")}><MaterialIcon>arrow_back</MaterialIcon> BACK TO RESULTS</button><div className="app-page-title"><MicroLabel>RESCAN COMPARISON / SAMPLE DATA</MicroLabel><h1>Fewer exposures than yesterday.</h1></div>
          <div className="compare-scores"><div><MicroLabel>BEFORE / MAR 18</MicroLabel><strong>41</strong><span>/100</span></div><i><MaterialIcon>arrow_forward</MaterialIcon></i><div><MicroLabel>AFTER / TODAY</MicroLabel><strong>62</strong><span>/100</span></div></div>
          <div className="compare-grid"><article><span className="passed">5 RESOLVED</span><h3>Closed since the last scan</h3><p>Environment file blocked, storage policy updated, and three keys rotated.</p></article><article><span className="severity">2 NEW</span><h3>New since the last scan</h3><p>A source map and verbose API error appeared in the latest deployment.</p></article></div>
          <p className="report-disclaimer">{BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a guarantee of security.</p>
        </section>}

        {screen === "history" && <section className="app-screen">
          <div className="app-page-title row-title"><div><MicroLabel>APPS / ACME NOTES</MicroLabel><h1>Scan history.</h1></div><button className="button primary" onClick={() => nav("new")}>New scan <Arrow /></button></div>
          <div className="history-table"><div className="history-row head"><span>Date</span><span>Scan</span><span>Score</span><span>Trend</span><span>Status</span></div>{[["Today, 10:42","LL-2025-031","62","complete"],["Mar 18, 16:08","LL-2025-024","41","complete"],["Mar 12, 09:21","LL-2025-018","—","failed"]].map((r,i) => <button className="history-row" key={r[1]} onClick={() => i === 2 ? nav("failed") : nav("results")}><span>{r[0]}</span><code>{r[1]}</code><strong>{r[2]}</strong><span className="spark"><i /><i /><i /><i /><i /></span><span className={r[3]}>{r[3]}</span></button>)}</div>
          <div className="empty-state"><MicroLabel>END OF HISTORY</MicroLabel><p>Earlier scans will appear here when they exist.</p><button onClick={() => nav("new")}>Run another scan</button></div>
        </section>}

        {screen === "apps" && <section className="app-screen">
          <div className="app-page-title row-title"><div><MicroLabel>APPS / SAMPLE DATA</MicroLabel><h1>Your apps.</h1><p>Verified apps available to this workspace.</p></div><button className="button primary" onClick={() => nav("new")}>Add an app <Arrow /></button></div>
          <div className="apps-grid">
            <button className="app-card" onClick={() => nav("history")}><div><span>LL</span><i className="status-dot" /></div><MicroLabel>VERIFIED DOMAIN</MicroLabel><h3>Acme Notes</h3><code>{url || "acme-notes.app"}</code><footer><span>3 sample scans</span><strong>Score {securityScore} <MaterialIcon>arrow_forward</MaterialIcon></strong></footer></button>
            <div className="empty-app-card"><MicroLabel>NO OTHER APPS</MicroLabel><p>Your next verified app will appear here.</p><button onClick={() => nav("new")}>Add an app</button></div>
          </div>
        </section>}

        {screen === "settings" && <section className="app-screen">
          <div className="app-page-title"><MicroLabel>WORKSPACE / SETTINGS</MicroLabel><h1>Settings.</h1></div>
          <div className="settings-list">
            <section><div><h3>Profile</h3><p>Your sample account details.</p></div><div className="settings-fields"><label>NAME<input defaultValue="Alex Morgan" /></label><label>EMAIL<input defaultValue="alex@example.com" /></label><button className="button">Save profile</button></div></section>
            <section><div><h3>Verified domains</h3><p>Domains approved for scanning.</p></div><div className="domain-row"><span><i />acme-notes.app <small>VERIFIED</small></span><button>Remove</button></div></section>
            <section><div><h3>Notifications</h3><p>Choose what reaches your inbox.</p></div><label className="toggle-row"><input type="checkbox" defaultChecked /> Email me when a scan finishes</label></section>
            <section className="danger-zone"><div><h3>Danger zone</h3><p>Remove this sample workspace.</p></div><button>Delete workspace</button></section>
          </div>
        </section>}
        </div>
      </div>
    </div>
    {selected && <FindingDrawer finding={selected} onClose={() => setSelected(null)} onStatus={updateStatus} />}
    <Companion message={companionMessage} />
    {legalDocument && <LegalModal document={legalDocument} onClose={() => setLegalDocument(null)} />}
  </div>;
}

export default function App() {
  const [view, setView] = useState<"marketing" | "auth" | "app">("marketing");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [initialUrl, setInitialUrl] = useState("acme-notes.app");
  if (view === "app") return <LoggedInApp initialUrl={initialUrl} onExit={() => setView("marketing")} />;
  if (view === "auth") return <AuthScreen mode={authMode} onMode={setAuthMode} onSuccess={() => setView("app")} onBack={() => setView("marketing")} />;
  return <Marketing
    onLogin={() => { setAuthMode("login"); setView("auth"); window.scrollTo(0, 0); }}
    onEnter={(url) => { setInitialUrl(url); setAuthMode("signup"); setView("auth"); window.scrollTo(0, 0); }}
  />;
}
