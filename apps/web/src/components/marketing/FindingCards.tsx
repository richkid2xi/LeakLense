import { useEffect, useRef, useState, useCallback } from "react";
import {
  WHAT_WE_FIND_CARDS,
  WHAT_WE_FIND_FOOTNOTE,
  type WhatWeFindItem,
} from "./whatWeFindContent";

interface FindCardProps {
  item: WhatWeFindItem;
  cardIndex: number;
  activeMode: "before" | "after";
  onToggle: (mode: "before" | "after") => void;
}

function FindCard({ item, activeMode, onToggle }: FindCardProps) {
  const content = activeMode === "before" ? item.before : item.after;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onToggle("before");
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onToggle("after");
    }
  };

  return (
    <article className="find-card reveal-target" aria-labelledby={`find-card-title-${item.id}`}>
      {/* Top Meta Row */}
      <div className="find-card-meta">
        <span className="find-card-num">{item.number}</span>
        <div className="find-card-chips">
          {!item.implemented && (
            <span className="find-card-chip chip-dev">In development</span>
          )}
          <span className="find-card-chip">{item.statusChip}</span>
        </div>
      </div>

      {/* Title */}
      <h3 id={`find-card-title-${item.id}`} className="find-card-title">
        {item.title}
      </h3>

      {/* Explanation */}
      <p className="find-card-desc">{item.description}</p>

      {/* Evidence Snippet Block (fixed height to prevent layout shift) */}
      <div className="find-card-evidence-wrap" tabIndex={0} aria-label={`Sample evidence for ${item.title}`}>
        <div key={activeMode} className="find-card-evidence-inner">
          <code className="find-card-code">{content.evidenceCode}</code>
          <span className="find-card-caption">{content.evidenceCaption}</span>
        </div>
      </div>

      {/* State Line (crossfades on mode change with fixed height) */}
      <div
        key={activeMode}
        className="find-card-state-line"
        aria-label={`Status: ${content.stateLabel}`}
      >
        <span
          className={`find-card-state-dot dot-${content.stateDotClass}`}
          aria-hidden="true"
        />
        <span className="find-card-state-label">{content.stateLabel}</span>
      </div>

      {/* Segmented Toggle */}
      <div
        className="find-card-toggle"
        role="radiogroup"
        aria-label={`Inspection view for ${item.title}`}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          role="radio"
          aria-checked={activeMode === "before"}
          tabIndex={activeMode === "before" ? 0 : -1}
          className={`find-card-toggle-btn ${activeMode === "before" ? "is-active" : ""}`}
          onClick={() => onToggle("before")}
        >
          Before fix
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={activeMode === "after"}
          tabIndex={activeMode === "after" ? 0 : -1}
          className={`find-card-toggle-btn ${activeMode === "after" ? "is-active" : ""}`}
          onClick={() => onToggle("after")}
        >
          After fix
        </button>
      </div>
    </article>
  );
}

export function FindingCards() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modes, setModes] = useState<Array<"before" | "after">>(["before", "before", "before"]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hasRunAutoDemo, setHasRunAutoDemo] = useState(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const handleManualToggle = (index: number, mode: "before" | "after") => {
    clearTimers();
    setHasInteracted(true);
    setModes((prev) => {
      const next = [...prev];
      next[index] = mode;
      return next;
    });
  };

  // Auto demo: when section scrolls into view, cycle each card Before -> After -> Before once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !hasRunAutoDemo && !hasInteracted) {
          setHasRunAutoDemo(true);

          // Staggered transitions
          [0, 1, 2].forEach((cardIndex) => {
            const startDelay = 400 * cardIndex + 400;
            const resetDelay = startDelay + 1800;

            const t1 = setTimeout(() => {
              setModes((prev) => {
                const next = [...prev];
                next[cardIndex] = "after";
                return next;
              });
            }, startDelay);

            const t2 = setTimeout(() => {
              setModes((prev) => {
                const next = [...prev];
                next[cardIndex] = "before";
                return next;
              });
            }, resetDelay);

            timersRef.current.push(t1, t2);
          });
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimers();
    };
  }, [hasRunAutoDemo, hasInteracted, clearTimers]);

  return (
    <div ref={containerRef} className="find-cards-section">
      <div className="find-cards-grid" role="region" aria-label="What LeakLens finds demonstration">
        {WHAT_WE_FIND_CARDS.map((card, idx) => (
          <FindCard
            key={card.id}
            item={card}
            cardIndex={idx}
            activeMode={modes[idx] ?? "before"}
            onToggle={(mode) => handleManualToggle(idx, mode)}
          />
        ))}
      </div>

      <div className="find-cards-footnote">
        <a href={WHAT_WE_FIND_FOOTNOTE.href} className="find-cards-footnote-link">
          {WHAT_WE_FIND_FOOTNOTE.text}
          <span className="find-cards-footnote-arrow" aria-hidden="true">
            {" "}
            &rarr;
          </span>
        </a>
      </div>
    </div>
  );
}
