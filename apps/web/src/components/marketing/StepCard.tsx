import { useState, useEffect, useRef } from "react";
import { companionEvents } from "../../lib/companion/events";
import { Arrow } from "../common/MaterialIcon";
import {
  HOW_IT_WORKS_STEPS,
  VERIFICATION_METHODS,
  SCAN_STEP_CHECKS,
  FIX_STEP_SAMPLE,
  type StepItem,
} from "./howItWorksContent";

interface StepCardProps {
  step: StepItem;
  isActive: boolean;
  onNext: () => void;
  onBack: () => void;
  onScanApp: () => void;
}

export function StepCard({
  step,
  isActive,
  onNext,
  onBack,
  onScanApp,
}: StepCardProps) {
  return (
    <article
      className="step-card-content"
      aria-labelledby={`step-card-title-${step.id}`}
    >
      {/* Header */}
      <div className="step-card-header">
        <span className="step-card-microlabel">
          STEP {step.number} / {step.title.toUpperCase()}
        </span>
        <h3 id={`step-card-title-${step.id}`} className="step-card-title">
          {step.title}
        </h3>
        <p className="step-card-desc">{step.description}</p>
      </div>

      {/* Visual body according to step index */}
      <div className="step-card-visual">
        {step.stepIndex === 0 && <VerifyVisual isActive={isActive} />}
        {step.stepIndex === 1 && <ScanVisual isActive={isActive} />}
        {step.stepIndex === 2 && <FixVisual isActive={isActive} />}
      </div>

      {/* Navigation Footer */}
      <footer className="step-card-footer">
        <div className="step-card-footer-left">
          {step.stepIndex > 0 ? (
            <button
              type="button"
              className="step-card-back-btn"
              onClick={onBack}
              aria-label={`Go back to step ${step.stepIndex}`}
            >
              &larr; Back
            </button>
          ) : (
            <span className="step-card-back-placeholder" aria-hidden="true" />
          )}
        </div>

        <div className="step-card-indicator" aria-label={`Step ${step.stepIndex + 1} of ${HOW_IT_WORKS_STEPS.length}`}>
          <span>
            {step.stepIndex + 1} / {HOW_IT_WORKS_STEPS.length}
          </span>
        </div>

        <div className="step-card-footer-right">
          {step.stepIndex < HOW_IT_WORKS_STEPS.length - 1 ? (
            <button
              type="button"
              className="button primary step-card-next-btn"
              onClick={onNext}
              aria-label={`Continue to step ${step.stepIndex + 2}: ${HOW_IT_WORKS_STEPS[step.stepIndex + 1]?.title}`}
            >
              Next <Arrow />
            </button>
          ) : (
            <button
              type="button"
              className="button primary step-card-next-btn"
              onClick={onScanApp}
              aria-label="Scan your app - scroll to start scan form"
            >
              Scan your app <Arrow />
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

// -------------------------------------------------------------
// STEP 1 VISUAL: VERIFY
// -------------------------------------------------------------
function VerifyVisual({ isActive }: { isActive: boolean }) {
  const [activeMethodId, setActiveMethodId] = useState<"dns_txt" | "file" | "meta_tag">("dns_txt");
  const [isVerified, setIsVerified] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setIsVerified(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Reset and animate to "Verified" after ~1.2s when active
    setIsVerified(false);
    timerRef.current = setTimeout(() => {
      setIsVerified(true);
    }, 1200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive]);

  const selectedSnippet =
    VERIFICATION_METHODS.find((m) => m.id === activeMethodId) ?? VERIFICATION_METHODS[0];

  return (
    <div className="step-visual-verify">
      {/* Mini browser host bar */}
      <div className="step-verify-browser" tabIndex={0} aria-label="Target domain: your-app.com">
        <span className="step-verify-dot" />
        <span className="step-verify-dot" />
        <span className="step-verify-dot" />
        <b className="step-verify-host">your-app.com</b>
      </div>

      {/* Verification method chips */}
      <div className="step-verify-methods" role="tablist" aria-label="Verification method choices">
        {VERIFICATION_METHODS.map((method) => (
          <button
            key={method.id}
            type="button"
            role="tab"
            aria-selected={activeMethodId === method.id}
            className={`step-verify-chip ${activeMethodId === method.id ? "is-selected" : ""}`}
            onClick={() => setActiveMethodId(method.id)}
          >
            {method.label}
          </button>
        ))}
      </div>

      {/* Code snippet display */}
      <div className="step-verify-snippet-wrap" tabIndex={0} aria-label="Verification snippet to add">
        <code className="step-verify-code">{selectedSnippet?.snippet}</code>
        <span className="step-verify-instruction">{selectedSnippet?.instruction}</span>
      </div>

      {/* Status Line */}
      <div className="step-verify-status-line" aria-live="polite">
        <span
          className={`step-verify-status-dot ${isVerified ? "dot-verified" : "dot-awaiting"}`}
          aria-hidden="true"
        />
        <span className="step-verify-status-text">
          {isVerified ? "Domain verified" : "Awaiting verification..."}
        </span>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// STEP 2 VISUAL: SCAN
// -------------------------------------------------------------
function ScanVisual({ isActive }: { isActive: boolean }) {
  const [resolvedIndices, setResolvedIndices] = useState<number[]>([]);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    if (!isActive) {
      setResolvedIndices([]);
      clearAllTimers();
      return;
    }

    setResolvedIndices([]);
    clearAllTimers();

    // Resolve checks one by one over ~2.5 seconds (0.5s, 1.1s, 1.7s, 2.3s)
    const delays = [500, 1100, 1700, 2300];
    delays.forEach((delay, idx) => {
      const t = setTimeout(() => {
        setResolvedIndices((prev) => [...prev, idx]);
      }, delay);
      timersRef.current.push(t);
    });

    return () => clearAllTimers();
  }, [isActive]);

  return (
    <div className="step-visual-scan">
      <div className="step-scan-rows" role="region" aria-label="Read-only checks list">
        {SCAN_STEP_CHECKS.map((check, idx) => {
          const isResolved = resolvedIndices.includes(idx);
          const isPassed = check.resultStatus === "passed";

          return (
            <div key={check.id} className="step-scan-row">
              <div className="step-scan-row-left">
                <span
                  className={`step-scan-dot ${
                    isResolved
                      ? isPassed
                        ? "dot-passed"
                        : "dot-issue"
                      : "dot-checking"
                  }`}
                  aria-hidden="true"
                />
                <span className="step-scan-title">{check.title}</span>
                {!check.implemented && (
                  <span className="step-scan-dev-chip">In development</span>
                )}
              </div>

              <div className="step-scan-row-right">
                <span
                  className={`step-scan-status-label ${
                    isResolved
                      ? isPassed
                        ? "label-passed"
                        : "label-issue"
                      : "label-checking"
                  }`}
                >
                  {isResolved ? check.resultLabel : "Checking..."}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="step-scan-disclaimer">
        Read-only. Nothing in your app is changed.
      </p>
    </div>
  );
}

// -------------------------------------------------------------
// STEP 3 VISUAL: FIX
// -------------------------------------------------------------
function FixVisual({ isActive }: { isActive: boolean }) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setCopied(false);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyPrompt = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(FIX_STEP_SAMPLE.promptToCopy);
      }
    } catch {
      // Graceful fallback for restricted environments
    }

    setCopied(true);
    companionEvents.emit("fix_prompt_copied", {});

    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div className="step-visual-fix">
      {/* Sample finding summary card */}
      <div className="step-fix-finding">
        <div className="step-fix-finding-top">
          <span className="step-fix-severity-badge">
            <span className="step-fix-sev-dot" aria-hidden="true" />
            {FIX_STEP_SAMPLE.severityLabel}
          </span>
          <span className="step-fix-finding-title">{FIX_STEP_SAMPLE.title}</span>
        </div>

        <p className="step-fix-explanation">{FIX_STEP_SAMPLE.explanation}</p>

        <div className="step-fix-evidence" tabIndex={0} aria-label="Masked credential sample">
          <span className="step-fix-evidence-label">Masked snippet</span>
          <code className="step-fix-evidence-code">{FIX_STEP_SAMPLE.maskedEvidence}</code>
        </div>
      </div>

      {/* Copy fix prompt trigger */}
      <div className="step-fix-action-wrap">
        <button
          type="button"
          className={`step-fix-copy-btn ${copied ? "is-copied" : ""}`}
          onClick={handleCopyPrompt}
          aria-label={copied ? "Fix prompt copied to clipboard" : "Copy fix prompt to clipboard"}
        >
          {copied ? "Copied" : "Copy fix prompt"}
          <span className="step-fix-btn-icon" aria-hidden="true">
            {copied ? "✓" : "📋"}
          </span>
        </button>
      </div>
    </div>
  );
}
