import { useState } from "react";
import { MaterialIcon } from "../common/MaterialIcon";

export function InteractiveFindingCards() {
  // Card 1 state: Keys
  const [keyMasked, setKeyMasked] = useState(false);
  const [entropyInspected, setEntropyInspected] = useState(false);

  // Card 2 state: Tables / RLS
  const [rlsEnforced, setRlsEnforced] = useState(false);

  // Card 3 state: Buckets
  const [bucketSecured, setBucketSecured] = useState(false);

  return (
    <div className="charts" aria-label="Interactive vulnerability demonstration workbench">
      {/* CARD 01: KEYS */}
      <div className="chart-card interactive-card">
        <div className="chart-head">
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <MaterialIcon style={{ fontSize: "15px", color: "#8FB4FF" }}>key</MaterialIcon>
            KEYS
          </span>
          <small style={{ color: "#8FB4FF" }}>LIVE DETECTOR</small>
        </div>

        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(3, 10, 30, 0.75)",
              border: "1px solid rgba(143, 180, 255, 0.3)",
              borderRadius: "2px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
            }}
          >
            <div style={{ color: "#8FB4FF", fontSize: "9px", marginBottom: "4px" }}>
              CLIENT BUNDLE (main.js)
            </div>
            <code style={{ color: keyMasked ? "#93c5fd" : "#fca5a5", overflowWrap: "anywhere" }}>
              {keyMasked
                ? 'const key = "sb_secret_••••••••••••"'
                : 'const key = "sb_secret_prod_89a7f342"'}
            </code>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              background: "rgba(1, 15, 46, 0.5)",
              border: "1px solid rgba(143, 180, 255, 0.18)",
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <span style={{ color: "#aecdff" }}>Entropy Score:</span>
            <strong style={{ color: entropyInspected ? "#86efac" : "#fbbf24" }}>
              {entropyInspected ? "4.82 bits (Secret verified)" : "Analyzing..."}
            </strong>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button
              onClick={() => {
                setKeyMasked(!keyMasked);
                setEntropyInspected(true);
              }}
              style={{
                flex: 1,
                padding: "8px 10px",
                background: keyMasked ? "#1F4FD8" : "rgba(143, 180, 255, 0.15)",
                color: "#fff",
                border: "1px solid rgba(143, 180, 255, 0.4)",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                cursor: "pointer",
                borderRadius: "2px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <MaterialIcon style={{ fontSize: "14px" }}>{keyMasked ? "visibility" : "visibility_off"}</MaterialIcon>
              {keyMasked ? "Reveal Secret" : "Mask & Test Entropy"}
            </button>
          </div>
        </div>

        <span className="chart-index">01</span>
      </div>

      {/* CARD 02: TABLES / RLS */}
      <div className="chart-card interactive-card">
        <div className="chart-head">
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <MaterialIcon style={{ fontSize: "15px", color: "#8FB4FF" }}>table_chart</MaterialIcon>
            TABLES
          </span>
          <small style={{ color: "#8FB4FF" }}>RLS PROBER</small>
        </div>

        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(3, 10, 30, 0.75)",
              border: "1px solid rgba(143, 180, 255, 0.3)",
              borderRadius: "2px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#8FB4FF", fontSize: "9px" }}>public.profiles</span>
              <span
                style={{
                  color: rlsEnforced ? "#86efac" : "#f87171",
                  fontSize: "9px",
                  fontWeight: 600,
                }}
              >
                {rlsEnforced ? "RLS: ACTIVE" : "RLS: MISSING"}
              </span>
            </div>
            <code style={{ color: rlsEnforced ? "#86efac" : "#fed7aa", fontSize: "10px" }}>
              {rlsEnforced
                ? "HTTP 200 [] (0 rows returned to anon)"
                : 'HTTP 200 [{"id":1,"role":"admin","email":"..."}]'}
            </code>
          </div>

          <div
            style={{
              padding: "8px 10px",
              background: "rgba(1, 15, 46, 0.5)",
              border: "1px solid rgba(143, 180, 255, 0.18)",
              fontSize: "11px",
              color: "#dbe4ff",
              lineHeight: 1.4,
            }}
          >
            {rlsEnforced ? (
              <span style={{ color: "#86efac" }}>
                ✓ Protected: Anonymous visitors cannot read private rows without session tokens.
              </span>
            ) : (
              <span style={{ color: "#fca5a5" }}>
                ⚠️ Exposed: Missing Row-Level Security allows anyone to query full user records.
              </span>
            )}
          </div>

          <div style={{ marginTop: "4px" }}>
            <button
              onClick={() => setRlsEnforced(!rlsEnforced)}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: rlsEnforced ? "rgba(46, 125, 79, 0.4)" : "#1F4FD8",
                color: "#fff",
                border: "1px solid rgba(143, 180, 255, 0.4)",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                cursor: "pointer",
                borderRadius: "2px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <MaterialIcon style={{ fontSize: "14px" }}>{rlsEnforced ? "lock_open" : "security"}</MaterialIcon>
              {rlsEnforced ? "Disable Policy (Simulate Leak)" : "Enforce Row-Level Security"}
            </button>
          </div>
        </div>

        <span className="chart-index">02</span>
      </div>

      {/* CARD 03: BUCKETS */}
      <div className="chart-card interactive-card">
        <div className="chart-head">
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <MaterialIcon style={{ fontSize: "15px", color: "#8FB4FF" }}>folder_open</MaterialIcon>
            BUCKETS
          </span>
          <small style={{ color: "#8FB4FF" }}>STORAGE AUDIT</small>
        </div>

        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(3, 10, 30, 0.75)",
              border: "1px solid rgba(143, 180, 255, 0.3)",
              borderRadius: "2px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
            }}
          >
            <div style={{ color: "#8FB4FF", fontSize: "9px", marginBottom: "4px" }}>
              TARGET: s3://app-uploads/exports
            </div>
            <code style={{ color: bucketSecured ? "#86efac" : "#fca5a5" }}>
              {bucketSecured
                ? "GET /exports/2025.csv -> 403 Forbidden"
                : "GET /exports/2025.csv -> 200 OK (Public)"}
            </code>
          </div>

          <div
            style={{
              padding: "8px 10px",
              background: "rgba(1, 15, 46, 0.5)",
              border: "1px solid rgba(143, 180, 255, 0.18)",
              fontSize: "11px",
              color: "#dbe4ff",
              lineHeight: 1.4,
            }}
          >
            {bucketSecured ? (
              <span style={{ color: "#86efac" }}>
                ✓ Restricted: Bucket objects require pre-signed authorization URLs to download.
              </span>
            ) : (
              <span style={{ color: "#fca5a5" }}>
                ⚠️ Exposed: Public read permissions allow unauthenticated visitor file downloads.
              </span>
            )}
          </div>

          <div style={{ marginTop: "4px" }}>
            <button
              onClick={() => setBucketSecured(!bucketSecured)}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: bucketSecured ? "rgba(46, 125, 79, 0.4)" : "#1F4FD8",
                color: "#fff",
                border: "1px solid rgba(143, 180, 255, 0.4)",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                cursor: "pointer",
                borderRadius: "2px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <MaterialIcon style={{ fontSize: "14px" }}>{bucketSecured ? "lock_open" : "shield"}</MaterialIcon>
              {bucketSecured ? "Simulate Public Bucket" : "Lock Bucket Permissions"}
            </button>
          </div>
        </div>

        <span className="chart-index">03</span>
      </div>
    </div>
  );
}
