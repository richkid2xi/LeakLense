import { useEffect, useState } from "react";
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

  useEffect(() => {
    companionEvents.emit("modal_opened", { modalType: "finding_drawer" });
    return () => {
      companionEvents.emit("modal_closed", {});
    };
  }, []);
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
    <div className="drawer-scrim" onMouseDown={onClose}>
      <aside className="finding-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className={`app-badge ${severityClass(finding.severity)}`}>{finding.severity}</span>
          <button onClick={onClose} aria-label="Close details">
            CLOSE <MaterialIcon>close</MaterialIcon>
          </button>
        </div>
        <h2>{finding.title}</h2>
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
          <div className={`risk-note ${severityClass(finding.severity)}`}>
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
          <div className="fix-choice">
            <button className={fixMode === "manual" ? "active" : ""} onClick={() => setFixMode("manual")}>
              <MaterialIcon>construction</MaterialIcon>
              <span>
                Fix it yourself<small>Technical, best-practice steps</small>
              </span>
            </button>
            <button className={fixMode === "agent" ? "active" : ""} onClick={() => setFixMode("agent")}>
              <MaterialIcon>auto_awesome</MaterialIcon>
              <span>
                Give it to your agent<small>Ready-to-paste fix prompt</small>
              </span>
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
                <MaterialIcon>verified_user</MaterialIcon> Rotate compromised credentials first, apply least privilege, then verify with a clean rescan.
              </p>
            </div>
          ) : (
            <div className="agent-fix-block">
              <div className="app-tabs">
                {["Lovable", "Bolt", "Cursor", "v0", "Any agent"].map((x) => (
                  <button className={builder === x ? "active" : ""} onClick={() => setBuilder(x)} key={x}>
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
      </aside>
    </div>
  );
}
