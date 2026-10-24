import type { CompanionAction, SpeechPriority } from "./controller";
import type { CompanionEventKey, CompanionEventPayloads, SeverityLevel } from "./events";
import { companionStorage } from "./storage";

export interface DialogueLine {
  id: string;
  text: string;
  priority: SpeechPriority;
  severity?: SeverityLevel;
  actions?: CompanionAction[];
  cooldownMs?: number;
}

export interface DialogueContext {
  route: "marketing" | "auth" | "app";
  screen?: string;
  isScanning: boolean;
  hasCriticalOrHigh: boolean;
  hasFindings: boolean;
  isDrawerOpen: boolean;
  isIdle: boolean;
  isTyping: boolean;
  isModalOpen: boolean;
}

// All dialogue lines live in this single content dictionary
export const DIALOGUE_LINES: Record<string, DialogueLine[]> = {
  first_visit: [
    {
      id: "first_visit_welcome",
      text: "Welcome. I am your LeakLens guide. I follow along while you run checks.",
      priority: "normal",
      cooldownMs: 60000,
    },
  ],

  section_in_view: [
    {
      id: "section_hero",
      text: "Drop a URL above and we will look for common exposed secrets.",
      priority: "idle",
      cooldownMs: 20000,
    },
    {
      id: "section_how_it_works",
      text: "We run specific non-destructive requests to check for known exposure patterns.",
      priority: "idle",
      cooldownMs: 20000,
    },
    {
      id: "section_coverage",
      text: "Here is exactly what we check and what remains out of scope.",
      priority: "idle",
      cooldownMs: 20000,
    },
    {
      id: "section_pricing",
      text: "Start free for single checks, or upgrade for automated recurring runs.",
      priority: "idle",
      cooldownMs: 20000,
    },
    {
      id: "section_faq",
      text: "Got questions? We keep our check methods completely transparent.",
      priority: "idle",
      cooldownMs: 20000,
    },
  ],

  scan_started: [
    {
      id: "scan_started_1",
      text: "Scanning started. Running non-destructive checks against public endpoints.",
      priority: "normal",
      cooldownMs: 15000,
    },
    {
      id: "scan_started_2",
      text: "Checking for exposed credentials and publicly accessible configuration.",
      priority: "normal",
      cooldownMs: 15000,
    },
  ],

  scan_step_changed: [
    {
      id: "step_keys",
      text: "Checking bundle files for exposed API keys and credentials.",
      priority: "idle",
      cooldownMs: 6000,
    },
    {
      id: "step_databases",
      text: "Testing database access rules and storage bucket permissions.",
      priority: "idle",
      cooldownMs: 6000,
    },
    {
      id: "step_config",
      text: "Inspecting environment leaks and public source maps.",
      priority: "idle",
      cooldownMs: 6000,
    },
  ],

  scan_finished_clean: [
    {
      id: "finished_clean_1",
      text: "No issues found in the checks we ran today.",
      priority: "normal",
      cooldownMs: 15000,
    },
  ],

  scan_finished_clean_with_untested: [
    {
      id: "finished_clean_untested",
      text: "No issues found in completed checks. Some checks could not run.",
      priority: "normal",
      cooldownMs: 15000,
    },
  ],

  scan_finished_low_medium: [
    {
      id: "finished_low_med_1",
      text: "Scan complete. Found minor items worth cleaning up when you have time.",
      priority: "normal",
      cooldownMs: 15000,
      actions: [
        {
          label: "Show me the worst one",
          action: "show_worst_finding",
        },
      ],
    },
  ],

  scan_finished_critical_high: [
    {
      id: "finished_critical_1",
      text: "Scan complete. Found exposures requiring immediate attention. Rotate keys first.",
      priority: "priority",
      severity: "Critical",
      cooldownMs: 10000,
      actions: [
        {
          label: "Show me the worst one",
          action: "show_worst_finding",
        },
      ],
    },
    {
      id: "finished_high_1",
      text: "High-priority items detected. Review the critical finding and revoke credentials.",
      priority: "priority",
      severity: "High",
      cooldownMs: 10000,
      actions: [
        {
          label: "Show me the worst one",
          action: "show_worst_finding",
        },
      ],
    },
  ],

  scan_failed: [
    {
      id: "scan_failed_unreachable",
      text: "The scan could not complete. The target domain was unreachable. Check the address.",
      priority: "priority",
      cooldownMs: 10000,
    },
    {
      id: "scan_failed_timeout",
      text: "Target server did not respond in time. Verify the domain is live.",
      priority: "priority",
      cooldownMs: 10000,
    },
  ],

  verification_started: [
    {
      id: "verif_started_1",
      text: "Checking your verification record now. DNS updates can take time to propagate.",
      priority: "normal",
      cooldownMs: 15000,
    },
  ],

  verification_succeeded: [
    {
      id: "verif_success_1",
      text: "Domain ownership confirmed. You can now launch full scans on this target.",
      priority: "normal",
      cooldownMs: 15000,
    },
  ],

  verification_failed: [
    {
      id: "verif_failed_dns",
      text: "Record not found yet. DNS records often take a few minutes to propagate.",
      priority: "priority",
      cooldownMs: 10000,
      actions: [
        {
          label: "Show me the steps again",
          action: "show_verification_steps",
        },
      ],
    },
  ],

  finding_opened_critical: [
    {
      id: "finding_crit_1",
      text: "Start with this one. Rotate the key first, then fix the code.",
      priority: "priority",
      severity: "Critical",
      cooldownMs: 5000,
      actions: [
        {
          label: "Copy fix prompt",
          action: "copy_fix_prompt",
        },
      ],
    },
  ],

  finding_opened_high: [
    {
      id: "finding_high_1",
      text: "High priority item. Invalidate the secret before committing fixes.",
      priority: "priority",
      severity: "High",
      cooldownMs: 5000,
      actions: [
        {
          label: "Copy fix prompt",
          action: "copy_fix_prompt",
        },
      ],
    },
  ],

  finding_opened_medium: [
    {
      id: "finding_med_1",
      text: "Review this configuration item to ensure intended public access.",
      priority: "normal",
      severity: "Medium",
      cooldownMs: 5000,
      actions: [
        {
          label: "Copy fix prompt",
          action: "copy_fix_prompt",
        },
      ],
    },
  ],

  finding_opened_low: [
    {
      id: "finding_low_1",
      text: "Minor exposure pattern. Good practice to tighten this up.",
      priority: "idle",
      severity: "Low",
      cooldownMs: 5000,
      actions: [
        {
          label: "Copy fix prompt",
          action: "copy_fix_prompt",
        },
      ],
    },
  ],

  fix_prompt_copied: [
    {
      id: "fix_copied_1",
      text: "Fix prompt copied. Paste it into your AI editor or send to your team.",
      priority: "normal",
      cooldownMs: 10000,
    },
  ],

  finding_status_fixed: [
    {
      id: "status_fixed_1",
      text: "Marked as fixed. Nice work closing that exposure.",
      priority: "normal",
      cooldownMs: 10000,
    },
  ],

  finding_status_ignored: [
    {
      id: "status_ignored_1",
      text: "Marked as ignored. It will remain excluded from alerts.",
      priority: "idle",
      cooldownMs: 10000,
    },
  ],

  idle_started: [
    {
      id: "idle_resting_1",
      text: "Sensors idling. Ready whenever you want to run another check.",
      priority: "idle",
      cooldownMs: 30000,
    },
    {
      id: "idle_resting_2",
      text: "Taking a quick breather. I will wake up when you are ready.",
      priority: "idle",
      cooldownMs: 30000,
    },
  ],

  error_shown: [
    {
      id: "error_generic_1",
      text: "Something went wrong with that request. Please try your action again.",
      priority: "priority",
      cooldownMs: 10000,
    },
  ],
};

export class DialogueEngine {
  private lastSpokenTimes = new Map<string, number>();
  private recentLineIds: string[] = [];
  private readonly maxRecentHistory = 10;

  public selectLineForEvent(
    event: CompanionEventKey,
    payload: unknown,
    context: DialogueContext
  ): DialogueLine | null {
    // Suppress speech if typing (unless high priority finding or error)
    if (context.isTyping && event !== "error_shown" && event !== "finding_opened") {
      return null;
    }

    const categoryKey = this.resolveCategoryKey(event, payload);
    if (!categoryKey) return null;

    const candidateLines = DIALOGUE_LINES[categoryKey];
    if (!candidateLines || candidateLines.length === 0) return null;

    // Filter by cooldown
    const now = Date.now();
    const available = candidateLines.filter((line) => {
      const lastSpoken = this.lastSpokenTimes.get(line.id) || 0;
      const cooldown = line.cooldownMs ?? 10000;
      return now - lastSpoken >= cooldown;
    });

    if (available.length === 0) {
      return null;
    }

    // Filter out recently seen lines to avoid repeating the last N lines
    const unseen = available.filter((line) => !this.recentLineIds.includes(line.id));
    const pool = unseen.length > 0 ? unseen : available;

    // Pick first or random from pool
    const selected = pool[Math.floor(Math.random() * pool.length)];
    if (!selected) return null;

    this.recordSpoken(selected.id);
    return selected;
  }

  private resolveCategoryKey(event: CompanionEventKey, payload: unknown): string | null {
    switch (event) {
      case "section_in_view": {
        const p = payload as CompanionEventPayloads["section_in_view"];
        if (p.sectionId === "hero") return "section_in_view";
        if (p.sectionId === "how-it-works") return "section_in_view";
        if (p.sectionId === "coverage") return "section_in_view";
        if (p.sectionId === "pricing") return "section_in_view";
        if (p.sectionId === "faq") return "section_in_view";
        return "section_in_view";
      }

      case "scan_started":
        return "scan_started";

      case "scan_step_changed":
        return "scan_step_changed";

      case "scan_finished": {
        const p = payload as CompanionEventPayloads["scan_finished"];
        if (p.severityCounts.critical > 0 || p.severityCounts.high > 0) {
          return "scan_finished_critical_high";
        }
        if (p.severityCounts.medium > 0 || p.severityCounts.low > 0) {
          return "scan_finished_low_medium";
        }
        if (p.couldNotTestCount > 0) {
          return "scan_finished_clean_with_untested";
        }
        return "scan_finished_clean";
      }

      case "scan_failed":
        return "scan_failed";

      case "verification_started":
        return "verification_started";

      case "verification_succeeded":
        return "verification_succeeded";

      case "verification_failed":
        return "verification_failed";

      case "finding_opened": {
        const p = payload as CompanionEventPayloads["finding_opened"];
        if (p.severity === "Critical") return "finding_opened_critical";
        if (p.severity === "High") return "finding_opened_high";
        if (p.severity === "Medium") return "finding_opened_medium";
        return "finding_opened_low";
      }

      case "fix_prompt_copied":
        return "fix_prompt_copied";

      case "finding_status_changed": {
        const p = payload as CompanionEventPayloads["finding_status_changed"];
        if (p.newStatus === "Fixed") return "finding_status_fixed";
        if (p.newStatus === "Ignored") return "finding_status_ignored";
        return null;
      }

      case "idle_started":
        return "idle_started";

      case "error_shown":
        return "error_shown";

      default:
        return null;
    }
  }

  public recordSpoken(lineId: string): void {
    this.lastSpokenTimes.set(lineId, Date.now());
    this.recentLineIds.push(lineId);
    if (this.recentLineIds.length > this.maxRecentHistory) {
      this.recentLineIds.shift();
    }
    companionStorage.addSeenLine(lineId);
  }

  public resetForTesting(): void {
    this.lastSpokenTimes.clear();
    this.recentLineIds = [];
  }
}

export const dialogueEngine = new DialogueEngine();
