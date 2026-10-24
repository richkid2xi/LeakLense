import { useEffect, useState } from "react";
import * as api from "../lib/api";
import type { FindingStatus, RescanComparison, UiFinding as Finding, UiScanSummary } from "../lib/api";
import { companionEvents, SeverityLevel } from "../lib/companion/events";
import { BRAND, checks } from "../constants/marketing";
import { Arrow, MaterialIcon } from "../components/common/MaterialIcon";
import { MicroLabel } from "../components/common/MicroLabel";
import { CopyBlock } from "../components/common/CopyBlock";
import { ScoreCount } from "../components/common/ScoreCount";
import { Companion } from "../components/common/Companion";
import { FindingDrawer, severityClass } from "../components/drawers/FindingDrawer";
import { LegalDocument, LegalModal } from "../components/modals/LegalModal";
import { validateScanUrl } from "../components/marketing/UrlForm";

export type Screen = "new" | "verify" | "progress" | "results" | "history" | "apps" | "compare" | "settings" | "failed";

const sampleFindings: Finding[] = api.initialMockFindings;

const scanSteps = ["Fetching app", "Reading bundle", "Checking Supabase", "Checking storage", "Building report"];
const scanMessages = [
  "Connecting to the deployed app",
  "Reading 14 public frontend assets",
  "Checking 6 public tables",
  "Reviewing 2 storage buckets",
  "Prioritising findings in plain English",
];
const checksRun: [string, string, string][] = api.initialMockChecksRun.map((c) => [c.name, c.status, c.reason || ""]);

export function LoggedInApp({ initialUrl, onExit }: { initialUrl: string; onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("new");
  const [url, setUrl] = useState(initialUrl);
  const [builder, setBuilder] = useState("Lovable");
  const [verifyTab, setVerifyTab] = useState("dns");
  const [verifyStatus, setVerifyStatus] = useState<"Waiting" | "Checking" | "Verified" | "Failed">("Waiting");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [findings, setFindings] = useState<Finding[]>(sampleFindings);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [accountOpen, setAccountOpen] = useState(false);
  const [cleanReport, setCleanReport] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [urlError, setUrlError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [scans, setScans] = useState<UiScanSummary[]>(api.initialMockScans);
  const [comparison, setComparison] = useState<RescanComparison | null>(null);
  const [verificationData, setVerificationData] = useState<api.VerificationChallenge | null>(null);

  useEffect(() => {
    api.getScans().then(setScans);
    api.getRescanComparison().then(setComparison);
  }, []);

  useEffect(() => {
    const method = verifyTab === "file" ? "file" : verifyTab === "meta" ? "meta" : "dns";
    api.startVerification(url, method).then(setVerificationData);
  }, [url, verifyTab]);

  const filtered = findings.filter(
    (f) =>
      (severityFilter === "All" || f.severity === severityFilter) &&
      (statusFilter === "All" || f.status === statusFilter)
  );
  const fixedCount = findings.filter((f) => f.status === "Fixed").length;
  const securityScore = 62 + Math.max(0, fixedCount - 2) * 4;
  const companionMessage =
    actionMessage ||
    (cleanReport && screen === "results"
      ? "No findings. Suspiciously responsible. Nice work."
      : screen === "new"
        ? "A URL first. Telepathy is still in beta."
        : screen === "verify" && verifyStatus === "Failed"
          ? "DNS is taking the scenic route. Try again in a moment."
          : screen === "progress"
            ? "You can stop staring at the progress bar. I’ve got this."
            : screen === "results"
              ? "Two critical findings. Your app has character."
              : screen === "settings"
                ? "The danger zone is accurately named. Refreshing."
                : "I watch the public edges. Quietly, mostly.");

  useEffect(() => {
    companionEvents.emit("route_changed", { route: "app", screen });
    if (screen === "failed") {
      companionEvents.emit("scan_failed", { reason: "Connection lost during public edge analysis." });
    }
  }, [screen]);

  useEffect(() => {
    if (legalDocument) {
      companionEvents.emit("modal_opened", { modalType: legalDocument });
    } else {
      companionEvents.emit("modal_closed", {});
    }
  }, [legalDocument]);

  useEffect(() => {
    return companionEvents.on("companion_action_requested", ({ actionId }) => {
      if (actionId === "show_worst_finding") {
        const worst =
          findings.find((f) => f.severity === "Critical") ||
          findings.find((f) => f.severity === "High") ||
          findings[0];
        if (worst) {
          handleSelectFinding(worst);
        }
      } else if (actionId === "show_verification_steps") {
        nav("verify");
      }
    });
  }, [findings]);

  useEffect(() => {
    if (screen !== "progress") return;
    companionEvents.emit("scan_started", { url, builder });
    setProgress(0);
    setElapsed(0);
    const timer = window.setInterval(() => {
      setElapsed((e) => e + 1);
      setProgress((p) => {
        const next = p + 1;
        if (next < scanSteps.length) {
          companionEvents.emit("scan_step_changed", {
            stepIndex: next,
            stepName: scanSteps[next] || "",
            stepMessage: scanMessages[next] || "",
          });
        }
        if (p >= scanSteps.length) {
          clearInterval(timer);
          window.setTimeout(() => {
            const counts = {
              critical: findings.filter((f) => f.severity === "Critical").length,
              high: findings.filter((f) => f.severity === "High").length,
              medium: findings.filter((f) => f.severity === "Medium").length,
              low: findings.filter((f) => f.severity === "Low").length,
            };
            companionEvents.emit("scan_finished", {
              severityCounts: counts,
              score: securityScore,
              couldNotTestCount: 0,
              clean: cleanReport,
            });
            setScreen("results");
          }, 450);
          return p;
        }
        return next;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [screen, findings, securityScore, cleanReport, url, builder]);

  const verify = async () => {
    const method = verifyTab === "file" ? "file" : verifyTab === "meta" ? "meta" : "dns";
    companionEvents.emit("verification_started", { method, domain: url });
    setVerifyStatus("Checking");
    const result = await api.checkVerification(url);
    setVerifyStatus(result.status);
    if (result.status === "Verified") {
      companionEvents.emit("verification_succeeded", { domain: url });
    } else {
      companionEvents.emit("verification_failed", {
        reason: "Verification value not found in public DNS or HTML meta tags.",
      });
    }
  };

  const nav = (next: Screen) => {
    setScreen(next);
    setSelected(null);
  };

  const continueToVerification = () => {
    const nextError = validateScanUrl(url);
    if (nextError) {
      setUrlError(nextError);
      setActionMessage(nextError);
      companionEvents.emit("error_shown", { message: nextError, context: "scan_url" });
      return;
    }
    if (!authorized) {
      const authErr = "Confirm that you own this site or are authorised to scan it.";
      setUrlError(authErr);
      setActionMessage("Ownership first. Even simulated scanners need boundaries.");
      companionEvents.emit("error_shown", { message: authErr, context: "ownership_checkbox" });
      return;
    }
    setUrlError("");
    setActionMessage("");
    nav("verify");
  };

  const handleSelectFinding = (f: Finding) => {
    setSelected(f);
    companionEvents.emit("finding_opened", {
      id: f.id,
      title: f.title,
      severity: f.severity as SeverityLevel,
      category: f.where,
      where: f.where,
    });
  };

  const updateStatus = async (status: Finding["status"]) => {
    if (selected) {
      await api.markFindingStatus(selected.id, status as FindingStatus);
      setFindings((items) => items.map((f) => (f.id === selected.id ? { ...f, status } : f)));
      setSelected({ ...selected, status });
      companionEvents.emit("finding_status_changed", { findingId: selected.id, newStatus: status });
    }
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <button className="app-logo" onClick={onExit}>
          {BRAND}
          <sup>®</sup>
        </button>
        <button className="sidebar-new" onClick={() => nav("new")}>
          <MaterialIcon>add</MaterialIcon> New scan
        </button>
        <nav>
          <button
            className={["history", "results", "compare", "failed"].includes(screen) ? "active" : ""}
            onClick={() => nav("history")}
          >
            <MaterialIcon>radar</MaterialIcon>Scans
          </button>
          <button onClick={() => nav("apps")} className={screen === "apps" ? "active" : ""}>
            <MaterialIcon>apps</MaterialIcon>Apps
          </button>
          <button onClick={() => nav("settings")} className={screen === "settings" ? "active" : ""}>
            <MaterialIcon>settings</MaterialIcon>Settings
          </button>
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button className="app-switcher">
            <span>LL</span>
            <b>Acme Notes</b>
            <MaterialIcon>expand_more</MaterialIcon>
          </button>
          <div className="account-wrap">
            <button className="account-button" onClick={() => setAccountOpen(!accountOpen)}>
              <span>AM</span>Alex Morgan <MaterialIcon>expand_more</MaterialIcon>
            </button>
            {accountOpen && (
              <div className="account-menu">
                <button onClick={() => nav("settings")}>Account settings</button>
                <button onClick={onExit}>Log out</button>
              </div>
            )}
          </div>
        </header>
        <div className="app-content">
          <div className="screen-transition" key={screen}>
            {screen === "new" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>NEW SCAN</MicroLabel>
                  <h1>What should we check?</h1>
                  <p>Choose your deployed app and the read-only checks to run.</p>
                </div>
                <div className="app-form-card">
                  <label>
                    APP URL
                    <input
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setUrlError("");
                        setActionMessage("");
                      }}
                      placeholder="https://your-app.com"
                      aria-invalid={Boolean(urlError)}
                    />
                    {urlError && (
                      <p className="field-error">
                        <MaterialIcon>error</MaterialIcon>
                        {urlError}
                      </p>
                    )}
                  </label>
                  <fieldset>
                    <legend>BUILDER</legend>
                    <div className="builder-select">
                      {["Lovable", "Bolt", "Cursor", "v0", "Other / not sure"].map((x) => (
                        <button className={builder === x ? "active" : ""} onClick={() => setBuilder(x)} key={x}>
                          {x}
                        </button>
                      ))}
                    </div>
                    <p className="field-helper">
                      Built by hand or not sure? Choose Other. We detect issues from what your site exposes, not from
                      the builder.
                    </p>
                  </fieldset>
                  <fieldset>
                    <legend>CHECKS</legend>
                    <div className="app-checks">
                      {checks.map((x) => (
                        <label key={x}>
                          <input type="checkbox" defaultChecked /> <span>{x}</span>
                        </label>
                      ))}
                    </div>
                    <a className="coverage-link" href="/#coverage">
                      What we check and don't check
                    </a>
                  </fieldset>
                  <label className="ownership-check">
                    <input
                      type="checkbox"
                      checked={authorized}
                      onChange={(e) => {
                        setAuthorized(e.target.checked);
                        setUrlError("");
                      }}
                    />
                    I own this site, or I'm authorised to scan it.
                  </label>
                  <button className="button primary app-action" onClick={continueToVerification}>
                    Continue to verification <Arrow />
                  </button>
                  <p className="scan-consent app-consent">
                    By continuing, you agree to the{" "}
                    <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and acknowledge the{" "}
                    <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.
                  </p>
                </div>
                <div className="empty-state">
                  <MicroLabel>NO OTHER DRAFTS</MicroLabel>
                  <p>Every new scan will appear here until you start it.</p>
                  <button onClick={() => document.querySelector<HTMLInputElement>(".app-form-card input")?.focus()}>
                    Enter an app URL
                  </button>
                </div>
              </section>
            )}

            {screen === "verify" && (
              <section className="app-screen">
                <button className="app-back" onClick={() => nav("new")}>
                  <MaterialIcon>arrow_back</MaterialIcon> BACK TO SCAN
                </button>
                <div className="app-page-title">
                  <MicroLabel>OWNERSHIP / REQUIRED</MicroLabel>
                  <h1>Verify {url || "your app"}.</h1>
                  <p>We ask for proof so LeakLens only scans apps you own.</p>
                </div>
                <div className="verify-card">
                  <div className="app-tabs">
                    <button className={verifyTab === "dns" ? "active" : ""} onClick={() => setVerifyTab("dns")}>
                      DNS TXT record
                    </button>
                    <button className={verifyTab === "meta" ? "active" : ""} onClick={() => setVerifyTab("meta")}>
                      HTML meta tag
                    </button>
                    <button className={verifyTab === "file" ? "active" : ""} onClick={() => setVerifyTab("file")}>
                      Verification file
                    </button>
                  </div>
                  <p>
                    {verifyTab === "dns"
                      ? "Add this TXT record to your domain, then return here."
                      : verifyTab === "meta"
                        ? "Add this tag inside the <head> of your deployed app."
                        : "Create this public file with the exact contents shown below."}
                  </p>
                  <CopyBlock
                    value={
                      verifyTab === "dns"
                        ? verificationData?.dnsValue || "leaklens-verification=ll_sample_3a82"
                        : verifyTab === "meta"
                          ? verificationData?.metaTagSnippet ||
                            '<meta name="leaklens-verification" content="ll_sample_3a82" />'
                          : verificationData
                            ? `${verificationData.filePath}\n${verificationData.fileContent}`
                            : "/.well-known/leaklens.txt\nleaklens-verification=ll_sample_3a82"
                    }
                  />
                  <p className="verify-note">Each domain and subdomain is verified separately.</p>
                  <div className={`live-status status-${verifyStatus.toLowerCase()}`}>
                    <i />
                    <div>
                      <MicroLabel>LIVE STATUS</MicroLabel>
                      <strong>{verifyStatus}</strong>
                      {verifyStatus === "Failed" && <p>We could not find the verification value yet.</p>}
                    </div>
                  </div>
                  {verifyStatus === "Verified" ? (
                    <button className="button primary app-action" onClick={() => nav("progress")}>
                      Start read-only scan <Arrow />
                    </button>
                  ) : (
                    <button className="button primary app-action" onClick={verify}>
                      Verify now <Arrow />
                    </button>
                  )}
                  <p className="scan-consent app-consent">
                    Starting a scan confirms your authorisation and acceptance of the{" "}
                    <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and{" "}
                    <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.
                  </p>
                  <button className="text-action" onClick={() => setVerifyStatus("Failed")}>
                    Preview failed verification
                  </button>
                </div>
              </section>
            )}

            {screen === "progress" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>SCAN LL-2025-031 / RUNNING</MicroLabel>
                  <h1>Looking at the public edges.</h1>
                  <p>You can leave this page. No changes are being made.</p>
                </div>
                <div className="progress-card">
                  <div className="progress-meta">
                    <span>
                      ELAPSED <b>00:{String(elapsed).padStart(2, "0")}</b>
                    </span>
                    <span>{Math.min(progress, 5)} / 5 CHECKS</span>
                  </div>
                  <div className="progress-rule">
                    <i style={{ width: `${Math.min((progress / 5) * 100, 100)}%` }} />
                  </div>
                  <div className="scan-stepper">
                    {scanSteps.map((step, i) => (
                      <div className={i < progress ? "done" : i === progress ? "current" : ""} key={step}>
                        <i>{i < progress ? <MaterialIcon>check</MaterialIcon> : String(i + 1).padStart(2, "0")}</i>
                        <strong>
                          {step}
                          <small>{i === progress ? scanMessages[i] : ""}</small>
                        </strong>
                        <span>{i < progress ? "Complete" : i === progress ? "Checking" : "Waiting"}</span>
                      </div>
                    ))}
                  </div>
                  <button className="text-action" onClick={() => nav("failed")}>
                    Preview failed scan
                  </button>
                </div>
              </section>
            )}

            {screen === "failed" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>SCAN FAILED</MicroLabel>
                  <h1>We lost the connection.</h1>
                  <p>The scan stopped before any checks completed. Your app was not changed.</p>
                </div>
                <div className="error-state">
                  <span>!</span>
                  <p>We couldn’t reach the app long enough to finish this scan.</p>
                  <button className="button primary" onClick={() => nav("progress")}>
                    Try the scan again
                  </button>
                </div>
              </section>
            )}

            {screen === "results" && (
              <section className="app-screen">
                {cleanReport ? (
                  <div className="clean-report">
                    <div className="clean-score">
                      <MicroLabel>EXPOSURE SCORE</MicroLabel>
                      <h1>
                        <ScoreCount target={100} />
                        <sup>/100</sup>
                      </h1>
                      <h2>No issues found in the checks we ran.</h2>
                      <p>Based only on the checks listed below. Not a full security audit.</p>
                      <a href="/#coverage">See what we don't check</a>
                    </div>
                    <div className="detected-stack">
                      <MicroLabel>DETECTED AUTOMATICALLY</MicroLabel>
                      <span>Supabase</span>
                      <span>Vite</span>
                      <span>Vercel</span>
                    </div>
                    <div className="checks-run">
                      <MicroLabel>CHECKS RUN</MicroLabel>
                      {checksRun.map(([name, status, reason]) => {
                        const cleanStatus = status === "Issue found" ? "Passed" : status;
                        return (
                          <div key={name}>
                            <span>
                              {name}
                              {reason && <small>{reason}</small>}
                            </span>
                            <b
                              className={`check-status ${cleanStatus.toLowerCase().replaceAll(" ", "-").replace("'", "")}`}
                            >
                              {cleanStatus}
                            </b>
                          </div>
                        );
                      })}
                    </div>
                    <div className="polish-grid">
                      <article>
                        <MaterialIcon>palette</MaterialIcon>
                        <MicroLabel>UI POLISH</MicroLabel>
                        <h3>Clarify destructive actions</h3>
                        <p>Add confirmation and undo states anywhere a user can permanently remove data.</p>
                      </article>
                      <article>
                        <MaterialIcon>account_tree</MaterialIcon>
                        <MicroLabel>ARCHITECTURE POLISH</MicroLabel>
                        <h3>Separate privileged work</h3>
                        <p>Keep admin operations behind server-only boundaries and log sensitive actions.</p>
                      </article>
                      <article>
                        <MaterialIcon>speed</MaterialIcon>
                        <MicroLabel>PERFORMANCE POLISH</MicroLabel>
                        <h3>Measure the slow path</h3>
                        <p>Add real-user monitoring before optimising whatever currently feels suspicious.</p>
                      </article>
                    </div>
                    <button className="button" onClick={() => setCleanReport(false)}>
                      View active findings
                    </button>
                    <p className="report-disclaimer">
                      {BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a
                      guarantee of security.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="results-hero">
                      <div>
                        <MicroLabel>EXPOSURE SCORE</MicroLabel>
                        <h1>
                          <span className="count-score">
                            <ScoreCount target={securityScore} />
                          </span>
                          <sup>/100</sup>
                        </h1>
                        <p>Needs attention</p>
                        <small>Based only on the checks listed below. Not a full security audit.</small>
                        <button
                          className="review-critical"
                          onClick={() => {
                            setSeverityFilter("Critical");
                            document.querySelector(".findings-table")?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Review critical findings <MaterialIcon>arrow_downward</MaterialIcon>
                        </button>
                      </div>
                      <div className="severity-summary">
                        {["Critical", "High", "Medium", "Low"].map((s) => (
                          <div key={s}>
                            <i className={severityClass(s)} />
                            <strong>{findings.filter((f) => f.severity === s).length}</strong>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="scan-meta">
                      <span>
                        SCAN ID <b>LL-2025-031</b>
                      </span>
                      <span>
                        APP <b>{url || "acme-notes.app"}</b>
                      </span>
                      <span>
                        BUILDER <b>{builder}</b>
                      </span>
                      <span>
                        FINISHED <b>JUST NOW</b>
                      </span>
                      <button onClick={() => nav("compare")}>
                        COMPARE RESCAN <MaterialIcon>arrow_forward</MaterialIcon>
                      </button>
                    </div>
                    <div className="detected-stack">
                      <MicroLabel>DETECTED AUTOMATICALLY</MicroLabel>
                      <span>Supabase</span>
                      <span>Vite</span>
                      <span>Vercel</span>
                    </div>
                    <button className="clean-preview" onClick={() => setCleanReport(true)}>
                      Preview a clean report
                    </button>
                    <div className="checks-run">
                      <div className="checks-run-head">
                        <MicroLabel>CHECKS RUN</MicroLabel>
                        <a href="/#coverage">View coverage</a>
                      </div>
                      {checksRun.map(([name, status, reason]) => (
                        <div key={name}>
                          <span>
                            {name}
                            {reason && <small>{reason}</small>}
                          </span>
                          <b className={`check-status ${status.toLowerCase().replaceAll(" ", "-").replace("'", "")}`}>
                            {status}
                          </b>
                        </div>
                      ))}
                    </div>
                    <div className="table-toolbar">
                      <div>
                        <button
                          className={severityFilter === "All" ? "active" : ""}
                          onClick={() => setSeverityFilter("All")}
                        >
                          All severities
                        </button>
                        {["Critical", "High", "Medium", "Low"].map((x) => (
                          <button onClick={() => setSeverityFilter(x)} key={x}>
                            {x}
                          </button>
                        ))}
                      </div>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option>All</option>
                        <option>Open</option>
                        <option>Fixed</option>
                        <option>Ignored</option>
                      </select>
                    </div>
                    {filtered.length ? (
                      <div className="findings-table">
                        <div className="table-row table-head">
                          <span>Severity</span>
                          <span>Finding</span>
                          <span>Where</span>
                          <span>Status</span>
                        </div>
                        {filtered.map((f) => (
                          <button className="table-row" onClick={() => handleSelectFinding(f)} key={f.id}>
                            <span>
                              <i className={`severity-dot ${severityClass(f.severity)}`} />
                              {f.severity}
                            </span>
                            <strong>{f.title}</strong>
                            <code>{f.where}</code>
                            <span>
                              {f.status} <MaterialIcon>chevron_right</MaterialIcon>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <MicroLabel>NO MATCHES</MicroLabel>
                        <p>No findings match these filters.</p>
                        <button
                          onClick={() => {
                            setSeverityFilter("All");
                            setStatusFilter("All");
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                    <p className="report-disclaimer">
                      {BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a
                      guarantee of security.
                    </p>
                  </>
                )}
              </section>
            )}

            {screen === "compare" && (
              <section className="app-screen">
                <button className="app-back" onClick={() => nav("results")}>
                  <MaterialIcon>arrow_back</MaterialIcon> BACK TO RESULTS
                </button>
                <div className="app-page-title">
                  <MicroLabel>RESCAN COMPARISON</MicroLabel>
                  <h1>Fewer exposures than yesterday.</h1>
                </div>
                <div className="compare-scores">
                  <div>
                    <MicroLabel>BEFORE / {comparison?.beforeDate || "MAR 18"}</MicroLabel>
                    <strong>{comparison?.beforeScore ?? 41}</strong>
                    <span>/100</span>
                  </div>
                  <i>
                    <MaterialIcon>arrow_forward</MaterialIcon>
                  </i>
                  <div>
                    <MicroLabel>AFTER / {comparison?.afterDate || "TODAY"}</MicroLabel>
                    <strong>{comparison?.afterScore ?? 62}</strong>
                    <span>/100</span>
                  </div>
                </div>
                <div className="compare-grid">
                  <article>
                    <span className="passed">{comparison?.resolvedCount ?? 5} RESOLVED</span>
                    <h3>Closed since the last scan</h3>
                    <p>
                      {comparison?.resolvedSummary ||
                        "Environment file blocked, storage policy updated, and three keys rotated."}
                    </p>
                  </article>
                  <article>
                    <span className="severity">{comparison?.newCount ?? 2} NEW</span>
                    <h3>New since the last scan</h3>
                    <p>
                      {comparison?.newSummary ||
                        "A source map and verbose API error appeared in the latest deployment."}
                    </p>
                  </article>
                </div>
                <p className="report-disclaimer">
                  {BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a
                  guarantee of security.
                </p>
              </section>
            )}

            {screen === "history" && (
              <section className="app-screen">
                <div className="app-page-title row-title">
                  <div>
                    <MicroLabel>APPS / ACME NOTES</MicroLabel>
                    <h1>Scan history.</h1>
                  </div>
                  <button className="button primary" onClick={() => nav("new")}>
                    New scan <Arrow />
                  </button>
                </div>
                <div className="history-table">
                  <div className="history-row head">
                    <span>Date</span>
                    <span>Scan</span>
                    <span>Score</span>
                    <span>Trend</span>
                    <span>Status</span>
                  </div>
                  {scans.map((r) => (
                    <button
                      className="history-row"
                      key={r.id}
                      onClick={() => (r.status === "failed" ? nav("failed") : nav("results"))}
                    >
                      <span>{r.date}</span>
                      <code>{r.id}</code>
                      <strong>{r.score}</strong>
                      <span className="spark">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className={r.status}>{r.status}</span>
                    </button>
                  ))}
                </div>
                <div className="empty-state">
                  <MicroLabel>END OF HISTORY</MicroLabel>
                  <p>Earlier scans will appear here when they exist.</p>
                  <button onClick={() => nav("new")}>Run another scan</button>
                </div>
              </section>
            )}

            {screen === "apps" && (
              <section className="app-screen">
                <div className="app-page-title row-title">
                  <div>
                    <MicroLabel>YOUR APPS</MicroLabel>
                    <h1>Your apps.</h1>
                    <p>Verified apps available to this workspace.</p>
                  </div>
                  <button className="button primary" onClick={() => nav("new")}>
                    Add an app <Arrow />
                  </button>
                </div>
                <div className="apps-grid">
                  <button className="app-card" onClick={() => nav("history")}>
                    <div>
                      <span>LL</span>
                      <i className="status-dot" />
                    </div>
                    <MicroLabel>VERIFIED DOMAIN</MicroLabel>
                    <h3>Acme Notes</h3>
                    <code>{url || "acme-notes.app"}</code>
                    <footer>
                      <span>3 completed scans</span>
                      <strong>
                        Score {securityScore} <MaterialIcon>arrow_forward</MaterialIcon>
                      </strong>
                    </footer>
                  </button>
                  <div className="empty-app-card">
                    <MicroLabel>NO OTHER APPS</MicroLabel>
                    <p>Your next verified app will appear here.</p>
                    <button onClick={() => nav("new")}>Add an app</button>
                  </div>
                </div>
              </section>
            )}

            {screen === "settings" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>WORKSPACE / SETTINGS</MicroLabel>
                  <h1>Settings.</h1>
                </div>
                <div className="settings-list">
                  <section>
                    <div>
                      <h3>Profile</h3>
                      <p>Your account details.</p>
                    </div>
                    <div className="settings-fields">
                      <label>
                        NAME
                        <input defaultValue="Alex Morgan" />
                      </label>
                      <label>
                        EMAIL
                        <input defaultValue="alex@example.com" />
                      </label>
                      <button className="button">Save profile</button>
                    </div>
                  </section>
                  <section>
                    <div>
                      <h3>Verified domains</h3>
                      <p>Domains approved for scanning.</p>
                    </div>
                    <div className="domain-row">
                      <span>
                        <i />
                        acme-notes.app <small>VERIFIED</small>
                      </span>
                      <button>Remove</button>
                    </div>
                  </section>
                  <section>
                    <div>
                      <h3>Notifications</h3>
                      <p>Choose what reaches your inbox.</p>
                    </div>
                    <label className="toggle-row">
                      <input type="checkbox" defaultChecked /> Email me when a scan finishes
                    </label>
                  </section>
                  <section className="danger-zone">
                    <div>
                      <h3>Danger zone</h3>
                      <p>Permanently delete this workspace and its scan history.</p>
                    </div>
                    <button>Delete workspace</button>
                  </section>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
      {selected && <FindingDrawer finding={selected} onClose={() => setSelected(null)} onStatus={updateStatus} />}
      <Companion message={companionMessage} />
      {legalDocument && <LegalModal document={legalDocument} onClose={() => setLegalDocument(null)} />}
    </div>
  );
}
