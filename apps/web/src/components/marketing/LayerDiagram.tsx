import { useEffect, useState } from "react";
import { MaterialIcon } from "../common/MaterialIcon";

interface ScanCheck {
  id: string;
  number: string;
  label: string;
  category: string;
  status: "CRITICAL" | "HIGH" | "PASSED" | "PROBING";
  target: string;
  findingTitle: string;
  detail: string;
  recommendation: string;
  codeSnippet: string;
  progressPercent: number;
}

const CHECKS: ScanCheck[] = [
  {
    id: "bundle",
    number: "01",
    label: "Frontend JS Bundle",
    category: "SECRETS / KEYS",
    status: "CRITICAL",
    target: "/assets/index-a81c.js",
    findingTitle: "Supabase service_role Key Exposed",
    detail: "High-entropy secret token embedded in client JavaScript bundle. Grants admin privileges.",
    recommendation: "Rotate key immediately and replace with client anon key or server-side env var.",
    codeSnippet: 'const supabase = createClient(URL, "eyJhbGciOi...[SERVICE_ROLE_KEY]");',
    progressPercent: 32,
  },
  {
    id: "database",
    number: "02",
    label: "Supabase & Postgres RLS",
    category: "DATABASE RLS",
    status: "HIGH",
    target: "/rest/v1/profiles?select=*",
    findingTitle: "Public Read Permitted Without RLS",
    detail: "Anonymous client request returned table rows. Row-Level Security policy missing.",
    recommendation: "Enable RLS: ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;",
    codeSnippet: 'HTTP GET /rest/v1/profiles -> 200 OK · 14 rows returned to public visitor',
    progressPercent: 68,
  },
  {
    id: "storage",
    number: "03",
    label: "Storage Buckets",
    category: "PUBLIC STORAGE",
    status: "HIGH",
    target: "/storage/v1/s3/user-backups",
    findingTitle: "Public Read Bucket Listing Enabled",
    detail: "Cloud storage bucket policy permits public listing of user uploaded archives.",
    recommendation: "Set bucket privacy to restricted and generate signed URLs for downloads.",
    codeSnippet: '<ListBucketResult><Contents><Key>backups/export_2025.csv</Key></Contents>',
    progressPercent: 92,
  },
  {
    id: "files",
    number: "04",
    label: "Sensitive Files",
    category: "CONFIG EXPOSURE",
    status: "PASSED",
    target: "/.env.production · /.git/config",
    findingTitle: "No Sensitive Environment Files Reachable",
    detail: "Environment configs and Git metadata safely blocked by web server edge.",
    recommendation: "Properly configured web server response: HTTP 404/403.",
    codeSnippet: "GET /.env.production -> 404 Not Found · Server root secure",
    progressPercent: 100,
  },
];

export function LayerDiagram() {
  const [activeCheckIndex, setActiveCheckIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState(false);

  // Auto-advance checks when not paused, allowing user to also interact directly
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveCheckIndex((prev) => (prev + 1) % CHECKS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused]);

  const activeCheck = CHECKS[activeCheckIndex] ?? CHECKS[0]!;

  return (
    <div className="terminal-scene" aria-label="Interactive exposure scanner workbench">
      <div className="terminal-window">
        {/* Titlebar with active controls */}
        <div className="terminal-titlebar">
          <span className="terminal-dots">
            <i />
            <i />
            <i />
          </span>
          <code>leaklens — interactive scanner engine · acme-notes.app</code>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "end" }}>
            <button
              onClick={() => setIsPaused(!isPaused)}
              style={{
                background: "transparent",
                border: "1px solid #444",
                color: isPaused ? "#8FB4FF" : "#aaa",
                padding: "3px 8px",
                fontSize: "10px",
                fontFamily: "JetBrains Mono, monospace",
                borderRadius: "2px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title={isPaused ? "Resume scanner cycle" : "Pause on this check"}
            >
              <MaterialIcon style={{ fontSize: "12px" }}>{isPaused ? "play_arrow" : "pause"}</MaterialIcon>
              {isPaused ? "RESUME" : "PAUSE"}
            </button>
            <MaterialIcon>terminal</MaterialIcon>
          </div>
        </div>

        {/* Interactive Step Switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            background: "#161616",
            borderBottom: "1px solid #282828",
          }}
          role="tablist"
          aria-label="Scanner inspection checks"
        >
          {CHECKS.map((check, idx) => {
            const isActive = idx === activeCheckIndex;
            return (
              <button
                key={check.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveCheckIndex(idx);
                  setIsPaused(true);
                }}
                style={{
                  padding: "10px 8px",
                  background: isActive ? "#1c1c1c" : "transparent",
                  color: isActive ? "#fff" : "#777",
                  border: "none",
                  borderBottom: isActive ? "2px solid #8FB4FF" : "2px solid transparent",
                  borderRight: idx < 3 ? "1px solid #242424" : "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  transition: "background 150ms ease, color 150ms ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <span style={{ fontSize: "9px", color: isActive ? "#8FB4FF" : "#555" }}>
                  [{check.number}] {check.category}
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {check.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body showing live inspectable probe */}
        <div className="terminal-body" style={{ minHeight: "260px", padding: "20px 24px 34px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <span className="prompt" style={{ color: "#8FB4FF" }}>probe@leaklens:~$</span>{" "}
              <code style={{ color: "#eee", fontSize: "12px" }}>check --target {activeCheck.target}</code>
            </div>
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "2px",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: ".06em",
                fontFamily: "JetBrains Mono, monospace",
                background:
                  activeCheck.status === "CRITICAL"
                    ? "#C62828"
                    : activeCheck.status === "HIGH"
                      ? "#D9622B"
                      : "#2E7D4F",
                color: "#fff",
              }}
            >
              {activeCheck.status}
            </span>
          </div>

          {/* Finding inspection box */}
          <div
            style={{
              background: "#161616",
              border: "1px solid #303030",
              borderRadius: "3px",
              padding: "14px 16px",
              margin: "12px 0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <i
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    display: "inline-block",
                    background:
                      activeCheck.status === "CRITICAL"
                        ? "#C62828"
                        : activeCheck.status === "HIGH"
                          ? "#D9622B"
                          : "#2E7D4F",
                  }}
                />
                <strong style={{ color: "#f0f0eb", fontSize: "13px", fontWeight: 500 }}>
                  {activeCheck.findingTitle}
                </strong>
              </div>
              <button
                onClick={() => setExpandedDetail(!expandedDetail)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8FB4FF",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {expandedDetail ? "Hide remediation" : "View remediation"}
                <MaterialIcon style={{ fontSize: "14px" }}>
                  {expandedDetail ? "expand_less" : "expand_more"}
                </MaterialIcon>
              </button>
            </div>

            <p style={{ color: "#aaa", fontSize: "12px", margin: "8px 0 10px", lineHeight: 1.5 }}>
              {activeCheck.detail}
            </p>

            {/* Code / network probe evidence */}
            <div
              style={{
                background: "#0c0c0c",
                border: "1px solid #222",
                padding: "8px 12px",
                borderRadius: "2px",
                color: "#7dd3fc",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                overflowWrap: "anywhere",
              }}
            >
              <code>{activeCheck.codeSnippet}</code>
            </div>

            {/* Expanded Fix Guidance */}
            {expandedDetail && (
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px dashed #333",
                  color: "#86efac",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: "#8FB4FF", fontWeight: 600 }}>HOW TO FIX: </span>
                {activeCheck.recommendation}
              </div>
            )}
          </div>

          {/* Progress track */}
          <div className="terminal-progress" style={{ position: "static", marginTop: "16px", height: "18px" }}>
            <span style={{ width: `${activeCheck.progressPercent}%`, transition: "width 400ms ease" }} />
            <code style={{ position: "static", float: "right", marginTop: "3px" }}>
              STAGE {activeCheck.number}/04 · {activeCheck.progressPercent}% ANALYSED
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
