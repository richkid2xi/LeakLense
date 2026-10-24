import { useEffect, useState } from "react";
import { companionEvents } from "../lib/companion/events";
import { BRAND, builderBrands, checks, faqs } from "../constants/marketing";
import { Companion } from "../components/common/Companion";
import { Arrow, MaterialIcon } from "../components/common/MaterialIcon";
import { MicroLabel } from "../components/common/MicroLabel";
import { CoverageContent } from "../components/marketing/CoverageContent";
import { FindingCards } from "../components/marketing/FindingCards";
import { HeroScanCard } from "../components/marketing/HeroScanCard";
import { StepsSection } from "../components/marketing/StepsSection";
import { UrlForm } from "../components/marketing/UrlForm";
import { LegalDocument, LegalModal } from "../components/modals/LegalModal";

export function MarketingView({ onEnter, onLogin }: { onEnter: (url: string) => void; onLogin: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [botMessage, setBotMessage] = useState(
    "Give me a deployed URL. I’ll look for the things your launch sprint politely ignored."
  );

  useEffect(() => {
    if (legalDocument) {
      companionEvents.emit("modal_opened", { modalType: legalDocument });
    } else {
      companionEvents.emit("modal_closed", {});
    }
  }, [legalDocument]);

  const fullHeadline = "Find what your website left open.";
  const [typedHeadline, setTypedHeadline] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      index++;
      setTypedHeadline(fullHeadline.slice(0, index));
      if (index >= fullHeadline.length) {
        clearInterval(interval);
        setTypingComplete(true);
      }
    }, 45);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const nodes = document.querySelectorAll(
      ".grid-section, .blue-band, .find-card, .safety-cards article, .finding-card"
    );
    nodes.forEach((node) => node.classList.add("reveal-target"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    nodes.forEach((node) => observer.observe(node));

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.id) {
            companionEvents.emit("section_in_view", {
              sectionId: entry.target.id,
            });
          }
        }
      },
      { threshold: 0.3 }
    );
    document.querySelectorAll("section[id]").forEach((el) => sectionObserver.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      sectionObserver.disconnect();
    };
  }, []);

  const beginScan = (url: string) => onEnter(url.replace(/^https?:\/\//, ""));
  const closeMenu = () => setMenuOpen(false);
  const copyPrompt = async () => {
    await navigator.clipboard?.writeText(
      "In Supabase, rotate this exposed key and move it to a server-side environment variable. Remove it from the client bundle, then redeploy."
    );
    setCopied(true);
    companionEvents.emit("fix_prompt_copied", {});
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main>
      <header className={`topbar ${navScrolled ? "scrolled" : ""}`}>
        <a className="wordmark" href="#top" onClick={closeMenu}>
          {BRAND}
          <sup>®</sup>
        </a>
        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MaterialIcon>{menuOpen ? "close" : "menu"}</MaterialIcon>
        </button>
        <nav className={menuOpen ? "open" : ""}>
          <a href="#findings" onClick={closeMenu}>
            What we find
          </a>
          <a href="#coverage" onClick={closeMenu}>
            Coverage
          </a>
          <a href="#how" onClick={closeMenu}>
            How it works
          </a>
          <a href="#safety" onClick={closeMenu}>
            Safety
          </a>
          <a href="#faq" onClick={closeMenu}>
            FAQ
          </a>
          <button className="nav-login" onClick={onLogin}>
            Log in
          </button>
          <a className="button primary nav-cta" href="#scan" onClick={closeMenu}>
            Scan my app
          </a>
        </nav>
      </header>

      <section className="hero grid-section" id="top">
        <div className="cross cross-tl" />
        <div className="cross cross-tr" />
        <h1>
          <span>{typedHeadline || "\u00A0"}</span>
          <span className={`hero-typewriter-cursor ${typingComplete ? "blink" : ""}`}>|</span>
        </h1>
        <p className="hero-copy">
          {BRAND} checks apps built with Lovable, Bolt, Cursor and v0, and any other website you own, for leaked keys
          and open databases. Then it gives you the fix in plain English.
        </p>
        <UrlForm onStart={beginScan} onFeedback={setBotMessage} />
        <p className="helper">
          You must prove you own or are authorised to scan the site. LeakLens will not scan unverified domains.
        </p>
        <p className="scan-consent">
          By starting a scan, you confirm you’re authorised and agree to the{" "}
          <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and acknowledge the{" "}
          <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.
        </p>
        <HeroScanCard />
      </section>

      <section className="stats grid-section">
        <div>
          <strong>3 min</strong>
          <span>Typical scan time</span>
        </div>
        <div>
          <strong>0</strong>
          <span>Changes made to your app</span>
        </div>
      </section>

      <section className="checks grid-section" id="findings">
        <div className="section-intro">
          <MicroLabel>01 / WHAT WE CHECK</MicroLabel>
          <h2>
            You shipped fast.
            <br />
            Your keys shipped too.
          </h2>
          <p>
            AI builders make it possible to go from idea to deployed app in a weekend. They can also make it easy to put
            sensitive things in public places.
          </p>
        </div>
        <div className="checklist">
          {checks.map((check, i) => (
            <div key={check}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>{check}</p>
              <b>CHECK</b>
            </div>
          ))}
        </div>
      </section>

      <section className="blue-band">
        <div className="blue-inner">
          <div className="blue-heading">
            <MicroLabel>02 / SIGNAL, NOT NOISE</MicroLabel>
            <h2>What we find.</h2>
            <p>Focused checks for the mistakes that matter most in public, AI-built apps.</p>
          </div>
          <FindingCards />
          <div className="blue-notes">
            <article>
              <MicroLabel>HOW WE CHECK</MicroLabel>
              <h3>From the outside, like a visitor.</h3>
              <p>
                We inspect only what your deployed app exposes publicly. No admin credentials, no private source code.
              </p>
            </article>
            <article>
              <MicroLabel>WHAT WE NEVER TOUCH</MicroLabel>
              <h3>Your data stays where it is.</h3>
              <p>We don’t write to tables, download user files, exploit vulnerabilities or make changes to your app.</p>
            </article>
          </div>
        </div>
      </section>

      <CoverageContent />

      <StepsSection />

      <section className="sample grid-section">
        <div className="frame-label">
          <MicroLabel>SAMPLE FINDING / 01</MicroLabel>
          <span>CLIENT BUNDLE</span>
        </div>
        <article className="finding-card">
          <div className="finding-top">
            <span className="severity">CRITICAL</span>
            <span>LL-KEY-001</span>
          </div>
          <h2>A live API key is visible in your frontend.</h2>
          <p>
            Anyone who opens your app can read this key. If it has write access, they may be able to use the service as
            if they were you.
          </p>
          <div className="masked-key">
            <span>FOUND IN /assets/index-a81c.js</span>
            <code>sk_live_••••••••••••4Kp2</code>
          </div>
          <button className="button primary" onClick={copyPrompt}>
            {copied ? "Copied" : "Copy fix prompt"} <Arrow />
          </button>
        </article>
      </section>

      <section className="safety grid-section" id="safety">
        <div className="section-title">
          <MicroLabel>04 / SAFETY BY DESIGN</MicroLabel>
          <h2>
            Clear boundaries.
            <br />
            No surprises.
          </h2>
        </div>
        <div className="safety-cards">
          <article>
            <span>01</span>
            <div className="line-icon shield" />
            <h3>Only apps you own</h3>
            <p>A scan starts only after you prove ownership with a DNS record or meta tag.</p>
          </article>
          <article>
            <span>02</span>
            <div className="line-icon eye" />
            <h3>Read-only, never exploits</h3>
            <p>We observe public behavior. We never alter data, escalate access or test destructive paths.</p>
          </article>
        </div>
      </section>

      <section className="builders grid-section">
        <MicroLabel>WORKS WITH</MicroLabel>
        <div className="chips">
          {builderBrands.map((brand) => (
            <span key={brand.name}>
              <img src={brand.logo} alt="" />
              {brand.name}
            </span>
          ))}
          <span>
            <MaterialIcon>language</MaterialIcon>Any website you own
          </span>
        </div>
      </section>

      <section className="faq grid-section" id="faq">
        <div>
          <MicroLabel>05 / FAQ</MicroLabel>
          <h2>The questions worth asking.</h2>
        </div>
        <div className="faq-list">
          {faqs.map(([q, a], i) => (
            <button key={q} onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
              <span>{q}</span>
              <i>
                <MaterialIcon>{openFaq === i ? "remove" : "add"}</MaterialIcon>
              </i>
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
        <p className="scan-consent">
          By starting a scan, you agree to the{" "}
          <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and acknowledge the{" "}
          <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.
        </p>
      </section>

      <footer>
        <div className="footer-grid">
          <div>
            <a className="wordmark" href="#top">
              {BRAND}
              <sup>®</sup>
            </a>
            <p>Plain-English security checks for apps built with AI.</p>
          </div>
          <div>
            <MicroLabel>EXPLORE</MicroLabel>
            <a href="#how">How it works</a>
            <a href="#findings">What we find</a>
            <a href="#coverage">Coverage</a>
            <a href="#safety">Safety</a>
          </div>
          <div>
            <MicroLabel>SUPPORT</MicroLabel>
            <a href="#faq">FAQ</a>
            <a href="#scan">Start a scan</a>
            <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>
            <button onClick={() => setLegalDocument("terms")}>Terms of Service</button>
          </div>
          <div>
            <MicroLabel>STATUS</MicroLabel>
            <p>
              <i className="status-dot" /> All systems operational
            </p>
          </div>
        </div>
        <div className="footer-mark">{BRAND}</div>
        <div className="legal">
          <span>© 2025 {BRAND}</span>
          <span>POWERED BY LEAKLENS ENGINE · CONTINUOUS EXPOSURE DETECTION</span>
        </div>
      </footer>
      <Companion message={botMessage} />
      {legalDocument && <LegalModal document={legalDocument} onClose={() => setLegalDocument(null)} />}
    </main>
  );
}
