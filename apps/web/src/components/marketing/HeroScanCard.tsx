import { useEffect, useRef, useState, useCallback } from "react";
import { Arrow, MaterialIcon } from "../common/MaterialIcon";
import { HERO_SCAN_CONTENT, type SampleCheckItem } from "./heroScanContent";
import { companionEvents } from "../../lib/companion/events";

type RowStatus = "pending" | "checking" | "resolved";

interface RowState {
  status: RowStatus;
}

export function HeroScanCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [rowStates, setRowStates] = useState<RowState[]>([
    { status: "pending" },
    { status: "pending" },
    { status: "pending" },
    { status: "pending" },
  ]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Run or replay the sequence
  const startSequence = useCallback(() => {
    clearAllTimers();
    setIsFinished(false);
    setLiveAnnouncement("");

    // Check if prefers-reduced-motion is enabled
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setRowStates([
        { status: "resolved" },
        { status: "resolved" },
        { status: "resolved" },
        { status: "resolved" },
      ]);
      setIsFinished(true);
      if (!hasUserInteracted) {
        setExpandedId(HERO_SCAN_CONTENT.checks[0]?.id ?? null);
      }
      setLiveAnnouncement("Sample scan complete. 4 checks run, 2 issues found.");
      return;
    }

    // Reset to checking state for first item, pending for others
    setRowStates([
      { status: "checking" },
      { status: "pending" },
      { status: "pending" },
      { status: "pending" },
    ]);
    setExpandedId(null);

    // Emit scan started event to companion if available
    try {
      companionEvents.emit("scan_started", { url: HERO_SCAN_CONTENT.hostname });
      companionEvents.emit("scan_step_changed", {
        stepIndex: 1,
        stepName: HERO_SCAN_CONTENT.checks[0]?.id || "keys",
        stepMessage: HERO_SCAN_CONTENT.checks[0]?.name,
      });
    } catch {
      // safe fallback
    }

    // Schedule stepping through checks
    const stepDelays = [800, 1800, 2800, 3800];

    // Resolve Step 1, Start Step 2
    const t1 = setTimeout(() => {
      setRowStates([
        { status: "resolved" },
        { status: "checking" },
        { status: "pending" },
        { status: "pending" },
      ]);
      try {
        companionEvents.emit("scan_step_changed", {
          stepIndex: 2,
          stepName: HERO_SCAN_CONTENT.checks[1]?.id || "database",
          stepMessage: HERO_SCAN_CONTENT.checks[1]?.name,
        });
      } catch {}
    }, stepDelays[0]);
    timersRef.current.push(t1);

    // Resolve Step 2, Start Step 3
    const t2 = setTimeout(() => {
      setRowStates([
        { status: "resolved" },
        { status: "resolved" },
        { status: "checking" },
        { status: "pending" },
      ]);
      try {
        companionEvents.emit("scan_step_changed", {
          stepIndex: 3,
          stepName: HERO_SCAN_CONTENT.checks[2]?.id || "storage",
          stepMessage: HERO_SCAN_CONTENT.checks[2]?.name,
        });
      } catch {}
    }, stepDelays[1]);
    timersRef.current.push(t2);

    // Resolve Step 3, Start Step 4
    const t3 = setTimeout(() => {
      setRowStates([
        { status: "resolved" },
        { status: "resolved" },
        { status: "resolved" },
        { status: "checking" },
      ]);
      try {
        companionEvents.emit("scan_step_changed", {
          stepIndex: 4,
          stepName: HERO_SCAN_CONTENT.checks[3]?.id || "config",
          stepMessage: HERO_SCAN_CONTENT.checks[3]?.name,
        });
      } catch {}
    }, stepDelays[2]);
    timersRef.current.push(t3);

    // Resolve Step 4, Finish
    const t4 = setTimeout(() => {
      setRowStates([
        { status: "resolved" },
        { status: "resolved" },
        { status: "resolved" },
        { status: "resolved" },
      ]);
      setIsFinished(true);

      // Auto-expand first issue row once if user hasn't intervened
      setExpandedId((curr) => {
        if (curr === null) {
          return HERO_SCAN_CONTENT.checks[0]?.id ?? null;
        }
        return curr;
      });

      setLiveAnnouncement("Sample scan complete. 4 checks run, 2 issues found.");

      try {
        companionEvents.emit("scan_finished", {
          clean: false,
          severityCounts: { critical: 0, high: 2, medium: 0, low: 0 },
          score: 62,
          couldNotTestCount: 0,
        });
      } catch {}
    }, stepDelays[3]);
    timersRef.current.push(t4);
  }, [clearAllTimers, hasUserInteracted]);

  // Trigger when card scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !hasStarted) {
          setHasStarted(true);
          startSequence();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearAllTimers();
    };
  }, [hasStarted, startSequence, clearAllTimers]);

  // Pause sequence when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isFinished) {
        clearAllTimers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isFinished, clearAllTimers]);

  // Count resolved checks and issues
  const resolvedCount = rowStates.filter((r) => r.status === "resolved").length;
  const issuesFoundCount = HERO_SCAN_CONTENT.checks.reduce((acc, check, idx) => {
    const state = rowStates[idx];
    if (state?.status === "resolved" && check.resultStatus === "issue") {
      return acc + 1;
    }
    return acc;
  }, 0);

  // Accordion toggle
  const toggleRow = (checkId: string) => {
    setHasUserInteracted(true);
    setExpandedId((curr) => (curr === checkId ? null : checkId));
  };

  // Keyboard navigation between accordion row buttons
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const totalRows = HERO_SCAN_CONTENT.checks.length;
    let nextIndex = -1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        nextIndex = (index + 1) % totalRows;
        break;
      case "ArrowUp":
        e.preventDefault();
        nextIndex = (index - 1 + totalRows) % totalRows;
        break;
      case "Home":
        e.preventDefault();
        nextIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextIndex = totalRows - 1;
        break;
    }

    if (nextIndex >= 0) {
      rowRefs.current[nextIndex]?.focus();
    }
  };

  // Copy fix prompt with confirmation
  const handleCopyPrompt = (check: SampleCheckItem) => {
    if (!check.fixPrompt) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(check.fixPrompt).catch(() => {});
    }
    setCopiedId(check.id);
    try {
      companionEvents.emit("fix_prompt_copied", { findingId: check.id });
    } catch {}
    setTimeout(() => {
      setCopiedId((curr) => (curr === check.id ? null : curr));
    }, 2000);
  };

  return (
    <div
      ref={containerRef}
      className="hero-scan-card"
      aria-label="Interactive sample scan overview"
    >
      {/* Screen reader live region for status completion */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </div>

      {/* Header Row */}
      <div className="hero-scan-header">
        <div className="hero-scan-header-left">
          <span className="hero-scan-tag">{HERO_SCAN_CONTENT.microLabel}</span>
          <span className="hero-scan-host">{HERO_SCAN_CONTENT.hostname}</span>
          <span className="hero-scan-disclaimer">{HERO_SCAN_CONTENT.disclaimer}</span>
        </div>
        <button
          type="button"
          className="hero-scan-replay-btn"
          onClick={() => {
            setHasUserInteracted(false);
            startSequence();
          }}
          aria-label="Replay sample scan"
        >
          <MaterialIcon className="hero-scan-replay-icon">refresh</MaterialIcon>
          <span>{HERO_SCAN_CONTENT.replayButtonLabel}</span>
        </button>
      </div>

      {/* Body: Vertical List of 4 Checks */}
      <div className="hero-scan-list" role="region" aria-label="Sample scan check items">
        {HERO_SCAN_CONTENT.checks.map((check, index) => {
          const rowState = rowStates[index] || { status: "pending" };
          const isChecking = rowState.status === "checking";
          const isResolved = rowState.status === "resolved";
          const isExpanded = isResolved && expandedId === check.id;
          const isIssue = isResolved && check.resultStatus === "issue";

          return (
            <div
              key={check.id}
              className={`hero-scan-row ${isResolved ? "is-resolved" : ""} ${
                isChecking ? "is-checking" : ""
              } ${isExpanded ? "is-expanded" : ""}`}
            >
              {/* Row Header Button */}
              <button
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                type="button"
                className="hero-scan-row-trigger"
                onClick={() => {
                  if (isResolved) toggleRow(check.id);
                }}
                onKeyDown={(e) => handleKeyDown(e, index)}
                aria-expanded={isExpanded}
                aria-controls={`hero-scan-panel-${check.id}`}
                id={`hero-scan-trigger-${check.id}`}
                disabled={!isResolved}
              >
                {/* Left: Dot + Number + Name */}
                <div className="hero-scan-row-left">
                  <span
                    className={`hero-scan-dot ${
                      isChecking
                        ? "dot-checking"
                        : isIssue
                          ? "dot-issue"
                          : isResolved
                            ? "dot-passed"
                            : "dot-pending"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="hero-scan-num">{check.number}</span>
                  <span className="hero-scan-name">{check.name}</span>
                </div>

                {/* Right: Status Pill + Chevron */}
                <div className="hero-scan-row-right">
                  {isChecking && (
                    <span className="hero-scan-pill pill-checking" aria-label="Checking">
                      <span className="pill-shimmer" />
                      Checking...
                    </span>
                  )}
                  {isResolved && (
                    <span
                      className={`hero-scan-pill ${
                        isIssue ? "pill-issue" : "pill-passed"
                      }`}
                    >
                      {check.resultLabel}
                    </span>
                  )}
                  {!isChecking && !isResolved && (
                    <span className="hero-scan-pill pill-pending">Pending</span>
                  )}

                  {isResolved && (
                    <span
                      className={`hero-scan-chevron ${isExpanded ? "is-open" : ""}`}
                      aria-hidden="true"
                    >
                      <MaterialIcon>expand_more</MaterialIcon>
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded Detail Panel */}
              {isResolved && isExpanded && (
                <div
                  id={`hero-scan-panel-${check.id}`}
                  role="region"
                  aria-labelledby={`hero-scan-trigger-${check.id}`}
                  className="hero-scan-detail"
                >
                  <div className="hero-scan-detail-inner">
                    <p className="hero-scan-explanation">{check.explanation}</p>

                    <div className="hero-scan-evidence" tabIndex={0}>
                      <code>{check.maskedEvidence}</code>
                    </div>

                    {check.fixPrompt && (
                      <div className="hero-scan-action-row">
                        <button
                          type="button"
                          className={`hero-scan-fix-btn ${
                            copiedId === check.id ? "is-copied" : ""
                          }`}
                          onClick={() => handleCopyPrompt(check)}
                          aria-label={`Copy fix prompt for ${check.name}`}
                        >
                          <MaterialIcon className="btn-icon">
                            {copiedId === check.id ? "check" : "content_copy"}
                          </MaterialIcon>
                          <span>
                            {copiedId === check.id ? "Copied" : "Copy fix prompt"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Line */}
      <div className="hero-scan-footer">
        <div className="hero-scan-footer-left">
          <span className="hero-scan-footer-summary">
            {HERO_SCAN_CONTENT.summaryTemplate(resolvedCount, issuesFoundCount)}
          </span>
        </div>
        <div className="hero-scan-footer-right">
          {isFinished ? (
            <div className="hero-scan-footer-actions">
              <span className="hero-scan-trust-badge">
                <span className="hero-scan-trust-dot" aria-hidden="true" />
                Read-only scan
              </span>
              <a
                href="#top"
                className="hero-scan-cta-link"
                onClick={(e) => {
                  e.preventDefault();
                  const input = document.querySelector<HTMLInputElement>(".url-form input");
                  if (input) {
                    input.scrollIntoView({ behavior: "smooth", block: "center" });
                    input.focus();
                  }
                }}
              >
                <span>Scan your website</span>
                <Arrow />
              </a>
            </div>
          ) : (
            <div className="hero-scan-footer-live">
              <span className="hero-scan-live-dot" aria-hidden="true" />
              <span>Analyzing client bundle...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
