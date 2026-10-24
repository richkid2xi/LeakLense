import { describe, it, expect, beforeEach } from "vitest";
import { transitionCompanionState, type StateMachineContext } from "./stateMachine";
import { DIALOGUE_LINES, DialogueEngine } from "./dialogue";
import { companionStorage } from "./storage";

describe("Companion State Machine", () => {
  const defaultContext: StateMachineContext = {
    route: "app",
    screen: "results",
    isScanning: false,
    hasCriticalOrHigh: false,
    hasFindings: false,
    isDrawerOpen: false,
    isIdle: false,
  };

  it("transitions to 'working' when scan starts", () => {
    const next = transitionCompanionState("idle", "scan_started", { url: "https://example.com" }, {
      ...defaultContext,
      isScanning: true,
    });
    expect(next).toBe("working");
  });

  it("transitions to 'relieved' when scan finishes clean", () => {
    const next = transitionCompanionState(
      "working",
      "scan_finished",
      {
        clean: true,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        score: 100,
        couldNotTestCount: 0,
      },
      defaultContext
    );
    expect(next).toBe("relieved");
  });

  it("transitions to 'serious' when scan finishes with critical or high findings", () => {
    const next = transitionCompanionState(
      "working",
      "scan_finished",
      {
        clean: false,
        severityCounts: { critical: 1, high: 0, medium: 2, low: 0 },
        score: 40,
        couldNotTestCount: 0,
      },
      { ...defaultContext, hasCriticalOrHigh: true, hasFindings: true }
    );
    expect(next).toBe("serious");
  });

  it("transitions to 'concerned' when scan finishes with only medium/low findings", () => {
    const next = transitionCompanionState(
      "working",
      "scan_finished",
      {
        clean: false,
        severityCounts: { critical: 0, high: 0, medium: 2, low: 1 },
        score: 75,
        couldNotTestCount: 0,
      },
      { ...defaultContext, hasFindings: true }
    );
    expect(next).toBe("concerned");
  });

  it("transitions to 'watching' on verification start, and 'concerned' on verification failure", () => {
    const watching = transitionCompanionState(
      "idle",
      "verification_started",
      { method: "dns", domain: "example.com" },
      defaultContext
    );
    expect(watching).toBe("watching");

    const failed = transitionCompanionState(
      watching,
      "verification_failed",
      { reason: "DNS TXT record not found" },
      defaultContext
    );
    expect(failed).toBe("concerned");
  });

  it("transitions to 'sleeping' on idle_started, and resumes on idle_ended", () => {
    const sleeping = transitionCompanionState(
      "idle",
      "idle_started",
      { idleSeconds: 45 },
      { ...defaultContext, isIdle: true }
    );
    expect(sleeping).toBe("sleeping");

    const resumed = transitionCompanionState(
      sleeping,
      "idle_ended",
      {},
      { ...defaultContext, isIdle: false, hasCriticalOrHigh: true }
    );
    expect(resumed).toBe("serious");
  });

  it("transitions to 'celebrating' when a finding is marked Fixed", () => {
    const celebrating = transitionCompanionState(
      "serious",
      "finding_status_changed",
      { findingId: 1, newStatus: "Fixed" },
      defaultContext
    );
    expect(celebrating).toBe("celebrating");
  });
});

describe("Companion Dialogue Engine & Selection Rules", () => {
  let engine: DialogueEngine;

  beforeEach(() => {
    engine = new DialogueEngine();
    companionStorage.resetForTests();
  });

  it("selects appropriate line for clean scan", () => {
    const line = engine.selectLineForEvent(
      "scan_finished",
      {
        clean: true,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        score: 100,
        couldNotTestCount: 0,
      },
      {
        route: "app",
        screen: "results",
        isScanning: false,
        hasCriticalOrHigh: false,
        hasFindings: false,
        isDrawerOpen: false,
        isIdle: false,
        isTyping: false,
        isModalOpen: false,
      }
    );

    expect(line).not.toBeNull();
    expect(line?.text).toContain("No issues found in the checks we ran today");
  });

  it("offers interactive action 'show_worst_finding' when scan has critical findings", () => {
    const line = engine.selectLineForEvent(
      "scan_finished",
      {
        clean: false,
        severityCounts: { critical: 1, high: 0, medium: 0, low: 0 },
        score: 40,
        couldNotTestCount: 0,
      },
      {
        route: "app",
        screen: "results",
        isScanning: false,
        hasCriticalOrHigh: true,
        hasFindings: true,
        isDrawerOpen: false,
        isIdle: false,
        isTyping: false,
        isModalOpen: false,
      }
    );

    expect(line).not.toBeNull();
    expect(line?.priority).toBe("priority");
    expect(line?.actions).toBeDefined();
    expect(line?.actions?.[0]?.action).toBe("show_worst_finding");
  });

  it("suppresses unprompted idle/normal speech while user is typing in an input", () => {
    const line = engine.selectLineForEvent(
      "scan_step_changed",
      { stepIndex: 1, stepName: "keys" },
      {
        route: "app",
        screen: "progress",
        isScanning: true,
        hasCriticalOrHigh: false,
        hasFindings: false,
        isDrawerOpen: false,
        isIdle: false,
        isTyping: true, // User is actively typing
        isModalOpen: false,
      }
    );

    expect(line).toBeNull();
  });

  it("enforces cooldowns between duplicate triggers", () => {
    const ctx = {
      route: "marketing" as const,
      isScanning: false,
      hasCriticalOrHigh: false,
      hasFindings: false,
      isDrawerOpen: false,
      isIdle: false,
      isTyping: false,
      isModalOpen: false,
    };

    const first = engine.selectLineForEvent(
      "verification_started",
      { method: "dns", domain: "example.com" },
      ctx
    );
    expect(first).not.toBeNull();

    // Immediate second trigger should be blocked by cooldown
    const second = engine.selectLineForEvent(
      "verification_started",
      { method: "dns", domain: "example.com" },
      ctx
    );
    expect(second).toBeNull();
  });

  it("tracks seen lines in storage and prevents immediate repeats", () => {
    engine.recordSpoken("scan_started_1");
    expect(companionStorage.hasSeenLine("scan_started_1")).toBe(true);
  });
});

describe("Companion Tone Rules Enforcement", () => {
  const FORBIDDEN_WORDS = [
    "secure",
    "safe",
    "protected",
    "guarantee",
    "100%",
    "hack-proof",
    "unhackable",
  ];

  const JOKEY_MARKERS_FOR_HIGH_CRITICAL = [
    "character",
    "yikes",
    "oops",
    "haha",
    "lol",
    "fun",
    "party",
    "wild",
    "yolo",
    "magic",
    "relax",
    "!",
  ];

  const allLines = Object.entries(DIALOGUE_LINES).flatMap(([category, lines]) =>
    lines.map((line) => ({ ...line, category }))
  );

  it("does not contain any forbidden words across all dialogue lines", () => {
    for (const line of allLines) {
      const lower = line.text.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        expect(
          lower.includes(word),
          `Forbidden word "${word}" found in dialogue line "${line.id}": "${line.text}"`
        ).toBe(false);
      }
    }
  });

  it("keeps every line concise (max 18 words, one idea per line)", () => {
    for (const line of allLines) {
      const wordCount = line.text.trim().split(/\s+/).length;
      expect(
        wordCount,
        `Line "${line.id}" exceeds 18 words (got ${wordCount}): "${line.text}"`
      ).toBeLessThanOrEqual(18);
    }
  });

  it("never includes jokes, playful markers, or exclamation marks on High or Critical severity lines", () => {
    const highAndCriticalLines = allLines.filter(
      (line) => line.severity === "Critical" || line.severity === "High"
    );

    expect(highAndCriticalLines.length).toBeGreaterThan(0);

    for (const line of highAndCriticalLines) {
      const lower = line.text.toLowerCase();
      for (const marker of JOKEY_MARKERS_FOR_HIGH_CRITICAL) {
        expect(
          lower.includes(marker),
          `Jokey or informal marker "${marker}" found in high/critical line "${line.id}": "${line.text}"`
        ).toBe(false);
      }
    }
  });

  it("uses proper 'No issues found in the checks we ran' language when zero findings", () => {
    const cleanLines = DIALOGUE_LINES["scan_finished_clean"] || [];
    expect(cleanLines.length).toBeGreaterThan(0);
    for (const line of cleanLines) {
      expect(line.text.toLowerCase()).toContain("no issues found in the checks we ran");
    }
  });
});
