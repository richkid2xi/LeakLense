import { describe, it, expect } from "vitest";
import { HERO_SCAN_CONTENT } from "./heroScanContent";

describe("HeroScanContent Tone and Data Specification", () => {
  const FORBIDDEN_WORDS = [
    "secure",
    "safe",
    "protected",
    "guarantee",
    "100%",
    "hack-proof",
    "unhackable",
  ];

  it("contains exactly 4 checks (2 issues found, 2 passed)", () => {
    expect(HERO_SCAN_CONTENT.checks).toHaveLength(4);
    const issues = HERO_SCAN_CONTENT.checks.filter((c) => c.resultStatus === "issue");
    const passed = HERO_SCAN_CONTENT.checks.filter((c) => c.resultStatus === "passed");
    expect(issues).toHaveLength(2);
    expect(passed).toHaveLength(2);
  });

  it("does not contain any forbidden marketing words in explanations or fix prompts", () => {
    for (const check of HERO_SCAN_CONTENT.checks) {
      const expLower = check.explanation.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        expect(
          expLower.includes(word),
          `Forbidden word "${word}" in explanation for "${check.id}": "${check.explanation}"`
        ).toBe(false);
      }

      if (check.fixPrompt) {
        const promptLower = check.fixPrompt.toLowerCase();
        for (const word of FORBIDDEN_WORDS) {
          expect(
            promptLower.includes(word),
            `Forbidden word "${word}" in fix prompt for "${check.id}": "${check.fixPrompt}"`
          ).toBe(false);
        }
      }
    }
  });

  it("tells the agent to rotate the key first on key findings", () => {
    const keyCheck = HERO_SCAN_CONTENT.checks.find((c) => c.id === "keys");
    expect(keyCheck).toBeDefined();
    expect(keyCheck?.fixPrompt?.toLowerCase()).toContain("rotate");
    expect(keyCheck?.fixPrompt?.toLowerCase()).toContain("first");
  });

  it("keeps each explanation to a single concise sentence", () => {
    for (const check of HERO_SCAN_CONTENT.checks) {
      const sentences = check.explanation
        .trim()
        .split(/[.!?]+/)
        .filter(Boolean);
      expect(
        sentences.length,
        `Explanation for "${check.id}" should be one sentence, got: "${check.explanation}"`
      ).toBe(1);
    }
  });

  it("verifies masked evidence never displays full raw credentials", () => {
    for (const check of HERO_SCAN_CONTENT.checks) {
      if (check.id === "keys") {
        expect(check.maskedEvidence).toContain("•••••");
      }
    }
  });
});
