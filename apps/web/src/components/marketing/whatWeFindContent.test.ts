import { describe, it, expect } from "vitest";
import {
  WHAT_WE_FIND_CARDS,
  WHAT_WE_FIND_FOOTNOTE,
} from "./whatWeFindContent";

describe("What We Find Cards Content Specification", () => {
  const FORBIDDEN_WORDS = [
    "secure",
    "safe",
    "protected",
    "guaranteed",
    "guarantee",
    "live",
    "real-time",
    "100%",
    "hack-proof",
    "unhackable",
  ];

  const FORBIDDEN_ACTION_PHRASES = [
    "leaklens fixed",
    "leaklens locks",
    "leaklens enforces",
    "leaklens modified",
    "enforce row-level security",
    "lock bucket permissions",
    "mask & test entropy",
    "entropy score",
  ];

  it("contains exactly 3 cards with expected IDs and numbers", () => {
    expect(WHAT_WE_FIND_CARDS).toHaveLength(3);
    expect(WHAT_WE_FIND_CARDS.map((c) => c.id)).toEqual(["keys", "tables", "storage"]);
    expect(WHAT_WE_FIND_CARDS.map((c) => c.number)).toEqual(["01", "02", "03"]);
  });

  it("has exact titles matching design spec", () => {
    expect(WHAT_WE_FIND_CARDS[0]?.title).toBe("Keys in your JavaScript");
    expect(WHAT_WE_FIND_CARDS[1]?.title).toBe("Open database tables");
    expect(WHAT_WE_FIND_CARDS[2]?.title).toBe("Public storage");
  });

  it("labels every card with Sample chip and accurate implementation status", () => {
    for (const card of WHAT_WE_FIND_CARDS) {
      expect(card.statusChip).toBe("Sample");
    }

    // Keys is implemented in packages/detectors; tables and storage are planned
    expect(WHAT_WE_FIND_CARDS[0]?.implemented).toBe(true);
    expect(WHAT_WE_FIND_CARDS[1]?.implemented).toBe(false);
    expect(WHAT_WE_FIND_CARDS[2]?.implemented).toBe(false);
  });

  it("keeps each description to one plain-English sentence of max 18 words", () => {
    for (const card of WHAT_WE_FIND_CARDS) {
      const sentences = card.description
        .trim()
        .split(/[.!?]+/)
        .filter(Boolean);
      expect(
        sentences.length,
        `Description for "${card.id}" should be one sentence, got: "${card.description}"`
      ).toBe(1);

      const wordCount = card.description.trim().split(/\s+/).length;
      expect(
        wordCount,
        `Description for "${card.id}" exceeds 18 words (${wordCount} words): "${card.description}"`
      ).toBeLessThanOrEqual(18);
    }
  });

  it("does not contain forbidden marketing or certainty words", () => {
    for (const card of WHAT_WE_FIND_CARDS) {
      const fullText = [
        card.title,
        card.description,
        card.before.evidenceCaption,
        card.before.stateLabel,
        card.after.evidenceCaption,
        card.after.stateLabel,
      ]
        .join(" ")
        .toLowerCase();

      for (const word of FORBIDDEN_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, "i");
        expect(
          regex.test(fullText),
          `Forbidden word "${word}" found in card "${card.id}": "${fullText}"`
        ).toBe(false);
      }

      for (const phrase of FORBIDDEN_ACTION_PHRASES) {
        expect(
          fullText.includes(phrase),
          `Forbidden action phrase "${phrase}" found in card "${card.id}": "${fullText}"`
        ).toBe(false);
      }
    }
  });

  it("masks sample secrets and never displays raw secret tokens or database row values", () => {
    const keysCard = WHAT_WE_FIND_CARDS.find((c) => c.id === "keys");
    expect(keysCard?.before.evidenceCode).toContain("•••••");
    expect(keysCard?.before.evidenceCode).not.toContain("sk-proj-super-secret-key-12345");

    const tablesCard = WHAT_WE_FIND_CARDS.find((c) => c.id === "tables");
    expect(tablesCard?.before.evidenceCode).toContain("(id, role, email)");
    // Should never contain real-looking row values
    expect(tablesCard?.before.evidenceCode).not.toContain("admin@example.com");

    const storageCard = WHAT_WE_FIND_CARDS.find((c) => c.id === "storage");
    expect(storageCard?.before.evidenceCode).toContain("•••••");
  });

  it("has consistent Before and After state labels", () => {
    for (const card of WHAT_WE_FIND_CARDS) {
      expect(card.before.stateLabel).toBe("Issue found");
      expect(card.before.stateDotClass).toBe("issue");

      expect(card.after.stateLabel).toBe("Fixed");
      expect(card.after.stateDotClass).toBe("fixed");
    }
  });

  it("has footnote link pointing to coverage page", () => {
    expect(WHAT_WE_FIND_FOOTNOTE.text).toBe("See everything we check and don't check");
    expect(WHAT_WE_FIND_FOOTNOTE.href).toBe("#coverage");
  });
});
