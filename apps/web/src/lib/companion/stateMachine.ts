import type { CompanionEventKey, CompanionEventPayloads } from "./events";

export type CompanionState =
  | "idle"
  | "curious"
  | "watching"
  | "working"
  | "relieved"
  | "concerned"
  | "serious"
  | "sleeping"
  | "celebrating";

export interface StateMachineContext {
  route: "marketing" | "auth" | "app";
  screen?: string;
  isScanning: boolean;
  hasCriticalOrHigh: boolean;
  hasFindings: boolean;
  isDrawerOpen: boolean;
  isIdle: boolean;
}

export function transitionCompanionState(
  currentState: CompanionState,
  event: CompanionEventKey,
  payload: unknown,
  ctx: StateMachineContext
): CompanionState {
  // Global event overrides
  if (event === "idle_started") {
    return "sleeping";
  }

  if (event === "idle_ended" && currentState === "sleeping") {
    if (ctx.isScanning) return "working";
    if (ctx.hasCriticalOrHigh) return "serious";
    if (ctx.hasFindings) return "concerned";
    if (ctx.screen === "verify" || ctx.screen === "new" || ctx.route === "auth") return "watching";
    return "idle";
  }

  switch (event) {
    case "scan_started":
      return "working";

    case "scan_step_changed":
      return "working";

    case "scan_finished": {
      const p = payload as CompanionEventPayloads["scan_finished"];
      if (p.clean || (p.severityCounts.critical === 0 && p.severityCounts.high === 0 && p.severityCounts.medium === 0 && p.severityCounts.low === 0)) {
        return "relieved";
      }
      if (p.severityCounts.critical > 0 || p.severityCounts.high > 0) {
        return "serious";
      }
      return "concerned";
    }

    case "scan_failed":
      return "concerned";

    case "verification_started":
      return "watching";

    case "verification_succeeded":
      return "relieved";

    case "verification_failed":
      return "concerned";

    case "finding_opened": {
      const p = payload as CompanionEventPayloads["finding_opened"];
      if (p.severity === "Critical" || p.severity === "High") {
        return "serious";
      }
      return "concerned";
    }

    case "fix_prompt_copied":
      return "relieved";

    case "finding_status_changed": {
      const p = payload as CompanionEventPayloads["finding_status_changed"];
      if (p.newStatus === "Fixed") {
        return "celebrating";
      }
      return currentState;
    }

    case "section_in_view":
      if (currentState === "sleeping") return "curious";
      if (currentState !== "working") return "curious";
      return currentState;

    case "route_changed": {
      const p = payload as CompanionEventPayloads["route_changed"];
      if (p.route === "marketing") return "idle";
      if (p.route === "auth") return "watching";
      if (p.route === "app") {
        if (p.screen === "progress") return "working";
        if (p.screen === "verify" || p.screen === "new") return "watching";
        if (p.screen === "results") {
          if (ctx.hasCriticalOrHigh) return "serious";
          if (ctx.hasFindings) return "concerned";
          return "relieved";
        }
        if (p.screen === "settings") return "curious";
        if (p.screen === "failed") return "concerned";
        return "idle";
      }
      return "idle";
    }

    case "error_shown":
      if (currentState === "working") return "working";
      return "concerned";

    default:
      return currentState;
  }
}
