import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import type { CompareFindingItem } from "../../lib/api/types";

export function ExpandableFindingGroup({
  title,
  count,
  type,
  findings,
}: {
  title: string;
  count: number;
  type: "resolved" | "new" | "unchanged" | "notTested";
  findings: CompareFindingItem[];
}) {
  const [isOpen, setIsOpen] = useState(count > 0);
  const [isExpandedAll, setIsExpandedAll] = useState(false);

  const displayedFindings = isExpandedAll ? findings : findings.slice(0, 3);
  const remainingCount = findings.length - 3;

  const typeBadgeClass =
    type === "resolved"
      ? "passed"
      : type === "new"
        ? "severity"
        : type === "unchanged"
          ? "neutral"
          : "muted";

  return (
    <article className="compare-card">
      <div
        className="compare-card-header"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <div>
          <span className={`app-badge ${typeBadgeClass}`}>
            {count} {title.toUpperCase()}
          </span>
          <h3 style={{ margin: "10px 0 4px", fontSize: "22px" }}>{title}</h3>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          aria-expanded={isOpen}
          aria-label={`Toggle ${title} findings`}
        >
          <MaterialIcon>{isOpen ? "expand_less" : "expand_more"}</MaterialIcon>
        </button>
      </div>

      {isOpen && (
        <div className="compare-card-body" style={{ marginTop: "14px" }}>
          {findings.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "13px", margin: "8px 0" }}>
              No {title.toLowerCase()} findings between these scans.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "8px 0 0",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {displayedFindings.map((f, i) => (
                <li
                  key={f.fingerprint || f.id || i}
                  style={{
                    padding: "10px 12px",
                    background: "white",
                    border: "1px solid var(--hairline)",
                    borderRadius: "2px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.title}
                    </span>
                    {f.where && (
                      <code
                        style={{
                          fontSize: "11px",
                          color: "var(--muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.where}
                      </code>
                    )}
                  </div>
                  {f.severity && (
                    <span
                      className={`app-badge sev-${f.severity.toLowerCase()}`}
                      style={{ flexShrink: 0, fontSize: "9px" }}
                    >
                      {f.severity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!isExpandedAll && remainingCount > 0 && (
            <button
              type="button"
              className="text-action"
              onClick={() => setIsExpandedAll(true)}
              style={{ marginTop: "12px", cursor: "pointer", background: "transparent", border: "none" }}
            >
              and {remainingCount} more
            </button>
          )}
        </div>
      )}
    </article>
  );
}
