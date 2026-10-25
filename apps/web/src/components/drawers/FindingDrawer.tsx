import { useEffect, useRef, useState } from "react";
import type { UiFinding as Finding } from "../../lib/api";
import { companionEvents } from "../../lib/companion/events";
import { MaterialIcon } from "../common/MaterialIcon";
import { MicroLabel } from "../common/MicroLabel";
import { CopyBlock } from "../common/CopyBlock";

export const severityClass = (severity: string) => `sev-${severity.toLowerCase()}`;

export function FindingDrawer({
  finding,
  onClose,
  onStatus,
}: {
  finding: Finding;
  onClose: () => void;
  onStatus: (status: Finding["status"]) => void;
}) {
  const [builder, setBuilder] = useState("Lovable");
  const [fixMode, setFixMode] = useState<"manual" | "agent">("manual");
  const drawerRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    companionEvents.emit("modal_opened", { modalType: "finding_drawer" });

    // Focus close button on open
    closeBtnRef.current?.focus();

    // Lock body/workspace scroll while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Escape listener and focus trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      companionEvents.emit("modal_closed", {});
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === "function") {
        previousActiveElement.current.focus();
      }
    };
  }, [onClose]);

  const promptLead: Record<string, string> = {
    Lovable: "Update this Lovable project and apply the following security fix without changing the current UI:",
    Bolt: "In this Bolt app, make the smallest scoped code and configuration changes required to:",
    Cursor: "Inspect the relevant files in this Cursor workspace, then implement and verify this fix:",
    v0: "Update the server-side implementation for this v0 app. Do not expose secrets to client components:",
    "Any agent":
      "Inspect this project and apply the following security fix using the project's existing framework and conventions:",
  };
  const prompt = `${promptLead[builder]} ${finding.title} at ${finding.where}. ${finding.steps.join(" ")} Preserve unrelated behavior and summarize the files changed.`;

  return (
    <div className="drawer-scrim" onMouseDown={onClose} role="dialog" aria-modal="true" aria-labelledby="finding-drawer-title">
      <aside
        ref={drawerRef}
        className="finding-drawer"
        onMouseDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <span className={`app-badge ${severityClass(finding.severity)}`}>{finding.severity}</span>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="drawer-close-btn"
            aria-label="Close details"
          >
            <span className="close-label">CLOSE</span>
            <MaterialIcon>close</MaterialIcon>
          </button>
        </div>

        <div className="drawer-body">
          <h2 id="finding-drawer-title">{finding.title}</h2>
          {finding.where && (
            <div className="drawer-path-chip">
              <code>{finding.where}</code>
            </div>
          )}

          <section className="drawer-section">
            <MicroLabel>WHAT THIS MEANS</MicroLabel>
            <p>{finding.meaning}</p>
          </section>

          <section className="drawer-section">
            <MicroLabel>WHY YOU SHOULD FIX THIS</MicroLabel>
            <p>{finding.why}</p>
            <div className={`calm-risk-callout ${severityClass(finding.severity)}`}>
              <MaterialIcon>crisis_alert</MaterialIcon>
              <span>
                {finding.severity === "Critical"
                  ? "Treat this as immediate: rotate exposed credentials before changing code, because copied secrets stay copied."
                  : finding.severity === "High"
                    ? "Fix this before the next release. Public access can turn a small configuration mistake into someone else’s data."
                    : "Schedule this fix soon. It reduces useful information and attack paths before they combine with a larger issue."}
              </span>
            </div>
          </section>

          <section className="drawer-section">
            <MicroLabel>EVIDENCE</MicroLabel>
            <div className="drawer-code-wrap">
              <CopyBlock value={finding.evidence} />
            </div>
          </section>

          <section className="drawer-section">
            <MicroLabel>HOW TO FIX</MicroLabel>
            {/* Responsive segmented control for mobile / desktop */}
            <div className="fix-segmented-control" role="tablist" aria-label="Remediation approach">
              <button
                type="button"
                role="tab"
                aria-selected={fixMode === "manual"}
                className={fixMode === "manual" ? "active" : ""}
                onClick={() => setFixMode("manual")}
              >
                <MaterialIcon>construction</MaterialIcon>
                <span>Fix it yourself</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fixMode === "agent"}
                className={fixMode === "agent" ? "active" : ""}
                onClick={() => setFixMode("agent")}
              >
                <MaterialIcon>auto_awesome</MaterialIcon>
                <span>Prompt for your AI agent</span>
              </button>
            </div>

            {fixMode === "manual" ? (
              <div className="manual-fix-block">
                <ol>
                  {finding.steps.map((step, i) => (
                    <li key={step}>
                      <span>0{i + 1}</span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
                <p className="manual-fix-tip">
                  <MaterialIcon>verified_user</MaterialIcon>
                  <span>Rotate compromised credentials first, apply least privilege, then verify with a clean rescan.</span>
                </p>
              </div>
            ) : (
              <div className="agent-fix-block">
                <div className="app-tabs">
                  {["Lovable", "Bolt", "Cursor", "v0", "Any agent"].map((x) => (
                    <button
                      type="button"
                      className={builder === x ? "active" : ""}
                      onClick={() => setBuilder(x)}
                      key={x}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <div className="drawer-prompt-wrap">
                  <MicroLabel>FIX PROMPT</MicroLabel>
                  <CopyBlock value={prompt} />
                </div>
              </div>
            )}
          </section>

          {/* Desktop status control */}
          <div className="desktop-status-wrap">
            <label className="status-control">
              STATUS
              <select value={finding.status} onChange={(e) => onStatus(e.target.value as Finding["status"])}>
                <option>Open</option>
                <option>Fixed</option>
                <option>Ignored</option>
              </select>
            </label>
            {finding.status === "Fixed" && (
              <p className="status-note">Marked fixed. A rescan is required to confirm the issue is resolved.</p>
            )}
          </div>
        </div>

        {/* Mobile sticky bottom bar */}
        <div className="drawer-mobile-bottom-bar">
          <label className="status-control mobile-status-control">
            STATUS
            <select value={finding.status} onChange={(e) => onStatus(e.target.value as Finding["status"])}>
              <option>Open</option>
              <option>Fixed</option>
              <option>Ignored</option>
            </select>
          </label>
          <button
            type="button"
            className="button primary mobile-copy-prompt-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
              } catch {}
            }}
          >
            <MaterialIcon>content_copy</MaterialIcon>
            <span>Copy fix prompt</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
