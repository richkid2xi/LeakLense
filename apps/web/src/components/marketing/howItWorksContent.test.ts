import { describe, it, expect } from "vitest";
import {
  HOW_IT_WORKS_STEPS,
  VERIFICATION_METHODS,
  SCAN_STEP_CHECKS,
  FIX_STEP_SAMPLE,
} from "./howItWorksContent";

describe("How It Works Content and Honesty Specification", () => {
  const FORBIDDEN_WORDS = [
    "secure",
    "safe",
    "protected",
    "guaranteed",
    "guarantee",
    "100%",
    "hack-proof",
    "unhackable",
  ];

  it("contains exactly 3 steps with numbers 01, 02, 03", () => {
    expect(HOW_IT_WORKS_STEPS).toHaveLength(3);
    expect(HOW_IT_WORKS_STEPS.map((s) => s.number)).toEqual(["01", "02", "03"]);
    expect(HOW_IT_WORKS_STEPS.map((s) => s.title)).toEqual(["Verify", "Scan", "Fix"]);
  });

  it("mirrors title and description for each step in a single concise sentence", () => {
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);

      const sentences = step.description
        .trim()
        .split(/[.!?]+/)
        .filter(Boolean);
      expect(
        sentences.length,
        `Step "${step.title}" description should be a single sentence: "${step.description}"`
      ).toBe(1);
    }
  });

  it("provides canonical verification methods for DNS TXT, File, and Meta tag", () => {
    expect(VERIFICATION_METHODS).toHaveLength(3);
    const ids = VERIFICATION_METHODS.map((m) => m.id);
    expect(ids).toContain("dns_txt");
    expect(ids).toContain("file");
    expect(ids).toContain("meta_tag");

    for (const method of VERIFICATION_METHODS) {
      expect(method.snippet).toContain("leaklens-verification");
      expect(method.instruction.length).toBeGreaterThan(0);
    }
  });

  it("contains exactly four scan checks resolving to two passed and two issue found", () => {
    expect(SCAN_STEP_CHECKS).toHaveLength(4);
    const passed = SCAN_STEP_CHECKS.filter((c) => c.resultStatus === "passed");
    const issues = SCAN_STEP_CHECKS.filter((c) => c.resultStatus === "issue");
    expect(passed).toHaveLength(2);
    expect(issues).toHaveLength(2);

    // Unimplemented checks must be marked implemented: false
    const tablesCheck = SCAN_STEP_CHECKS.find((c) => c.id === "tables");
    expect(tablesCheck?.implemented).toBe(false);
  });

  it("tells the agent to rotate the exposed key first in the fix prompt", () => {
    expect(FIX_STEP_SAMPLE.promptToCopy.toLowerCase()).toContain("rotate");
    expect(FIX_STEP_SAMPLE.promptToCopy.toLowerCase()).toContain("first");
  });

  it("masks sample credentials with bullets", () => {
    expect(FIX_STEP_SAMPLE.maskedEvidence).toContain("•••••");
    expect(FIX_STEP_SAMPLE.maskedEvidence).not.toContain("sk-proj-raw-live-key");
  });

  it("contains no forbidden marketing words across any step or visual text", () => {
    const allStrings: string[] = [
      ...HOW_IT_WORKS_STEPS.flatMap((s) => [s.title, s.description]),
      ...VERIFICATION_METHODS.flatMap((m) => [m.label, m.instruction]),
      ...SCAN_STEP_CHECKS.flatMap((c) => [c.title, c.category, c.resultLabel]),
      FIX_STEP_SAMPLE.title,
      FIX_STEP_SAMPLE.explanation,
      FIX_STEP_SAMPLE.promptToCopy,
    ];

    for (const text of allStrings) {
      const lower = text.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, "i");
        expect(
          regex.test(lower),
          `Forbidden word "${word}" found in How It Works text: "${text}"`
        ).toBe(false);
      }
    }
  });
});
