import { companionEvents, type CompanionEventKey, type CompanionEventPayloads } from "./events";
import {
  type CompanionState,
  type StateMachineContext,
  transitionCompanionState,
} from "./stateMachine";
import { companionStorage } from "./storage";
import { dialogueEngine } from "./dialogue";

export type SpeechPriority = "idle" | "normal" | "priority";

export type CompanionActionType =
  | "show_worst_finding"
  | "copy_fix_prompt"
  | "show_verification_steps"
  | "dismiss";

export interface CompanionAction {
  label: string;
  action: CompanionActionType;
  payload?: unknown;
}

export interface CompanionSpeech {
  id: string;
  text: string;
  priority: SpeechPriority;
  actions?: CompanionAction[];
  timestamp: number;
}

export interface ControllerContext extends StateMachineContext {
  isTyping: boolean;
  isDocumentHidden: boolean;
  isModalOpen: boolean;
  activeFindingSeverity: string | null;
  scanResults: {
    clean: boolean;
    severityCounts: { critical: number; high: number; medium: number; low: number };
    score: number;
    couldNotTestCount: number;
  } | null;
  verificationFailureReason: string | null;
  lastEvent: CompanionEventKey | null;
}

export interface ControllerSnapshot {
  state: CompanionState;
  speech: CompanionSpeech | null;
  isOpen: boolean;
  isMuted: boolean;
  isSleeping: boolean;
  isDocked: boolean;
  isTyping: boolean;
}

export type ControllerSubscriber = (snapshot: ControllerSnapshot) => void;

// Rate limit: at most one unprompted line every 8 seconds
const MIN_SPEECH_INTERVAL_MS = 8000;
// Idle timeout: 45 seconds of user inactivity before falling asleep
const IDLE_TIMEOUT_MS = 45000;

export class CompanionController {
  private state: CompanionState = "idle";
  private context: ControllerContext = {
    route: "marketing",
    screen: undefined,
    isScanning: false,
    hasCriticalOrHigh: false,
    hasFindings: false,
    isDrawerOpen: false,
    isIdle: false,
    isTyping: false,
    isDocumentHidden: false,
    isModalOpen: false,
    activeFindingSeverity: null,
    scanResults: null,
    verificationFailureReason: null,
    lastEvent: null,
  };

  private currentSpeech: CompanionSpeech | null = null;
  private isBubbleOpen: boolean = false;
  private lastSpeechTime: number = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private speechDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private firstVisitTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribers = new Set<ControllerSubscriber>();
  private unsubs: Array<() => void> = [];

  constructor() {
    this.initStorageAndState();
    this.setupEventListeners();
    this.setupDomListeners();
    this.resetIdleTimer();
  }

  private initStorageAndState(): void {
    const storage = companionStorage.load();
    if (storage.firstVisit) {
      this.state = "curious";
      companionStorage.markVisited();
      if (typeof window !== "undefined") {
        this.firstVisitTimer = setTimeout(() => {
          this.speak(
            "first_visit_welcome",
            "Welcome. I am your LeakLens guide. I follow along while you run checks.",
            "normal"
          );
        }, 1500);
      }
    } else {
      this.state = "idle";
    }
  }

  private setupEventListeners(): void {
    const events: CompanionEventKey[] = [
      "route_changed",
      "section_in_view",
      "scan_started",
      "scan_step_changed",
      "scan_finished",
      "scan_failed",
      "verification_started",
      "verification_succeeded",
      "verification_failed",
      "finding_opened",
      "fix_prompt_copied",
      "finding_status_changed",
      "idle_started",
      "idle_ended",
      "error_shown",
      "modal_opened",
      "modal_closed",
      "companion_action_requested",
    ];

    for (const evt of events) {
      const unsub = companionEvents.on(evt, (payload) => {
        this.handleEvent(evt, payload);
      });
      this.unsubs.push(unsub);
    }
  }

  private setupDomListeners(): void {
    if (typeof window === "undefined") return;

    // Inactivity tracking (resets idle timer on any user gesture)
    const onUserActivity = () => {
      this.handleUserActivity();
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    for (const evt of activityEvents) {
      window.addEventListener(evt, onUserActivity, { passive: true });
    }
    this.unsubs.push(() => {
      for (const evt of activityEvents) {
        window.removeEventListener(evt, onUserActivity);
      }
    });

    // Typing tracking (suppress unprompted speech while typing)
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        this.context.isTyping = true;
      }
    };

    const onFocusOut = () => {
      this.context.isTyping = false;
    };

    window.addEventListener("focusin", onFocusIn, { passive: true });
    window.addEventListener("focusout", onFocusOut, { passive: true });
    this.unsubs.push(() => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    });

    // Tab visibility (pause animations & speech when tab is hidden)
    const onVisibilityChange = () => {
      this.context.isDocumentHidden = document.hidden;
      if (document.hidden) {
        this.clearSpeechDismissTimer();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    this.unsubs.push(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  }

  private handleUserActivity(): void {
    if (this.context.isIdle) {
      this.context.isIdle = false;
      companionEvents.emit("idle_ended", {});
    }
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (typeof window === "undefined") return;

    this.idleTimer = setTimeout(() => {
      this.context.isIdle = true;
      companionEvents.emit("idle_started", { idleSeconds: 45 });
    }, IDLE_TIMEOUT_MS);
  }

  private handleEvent(event: CompanionEventKey, payload: unknown): void {
    this.context.lastEvent = event;

    // Update context based on event payload
    switch (event) {
      case "route_changed": {
        const p = payload as CompanionEventPayloads["route_changed"];
        this.context.route = p.route;
        this.context.screen = p.screen;
        if (p.route === "marketing") {
          this.context.isScanning = false;
          this.context.hasFindings = false;
          this.context.hasCriticalOrHigh = false;
        }
        break;
      }

      case "scan_started": {
        this.context.isScanning = true;
        this.context.hasFindings = false;
        this.context.hasCriticalOrHigh = false;
        this.context.scanResults = null;
        companionStorage.incrementScanCount();
        break;
      }

      case "scan_finished": {
        this.context.isScanning = false;
        const p = payload as CompanionEventPayloads["scan_finished"];
        this.context.scanResults = p;
        const total =
          p.severityCounts.critical +
          p.severityCounts.high +
          p.severityCounts.medium +
          p.severityCounts.low;
        this.context.hasFindings = total > 0;
        this.context.hasCriticalOrHigh =
          p.severityCounts.critical > 0 || p.severityCounts.high > 0;
        break;
      }

      case "scan_failed": {
        this.context.isScanning = false;
        break;
      }

      case "verification_failed": {
        const p = payload as CompanionEventPayloads["verification_failed"];
        this.context.verificationFailureReason = p.reason;
        break;
      }

      case "finding_opened": {
        const p = payload as CompanionEventPayloads["finding_opened"];
        this.context.isDrawerOpen = true;
        this.context.activeFindingSeverity = p.severity;
        break;
      }

      case "modal_opened": {
        const p = payload as CompanionEventPayloads["modal_opened"];
        if (p.modalType === "drawer") {
          this.context.isDrawerOpen = true;
        } else {
          this.context.isModalOpen = true;
        }
        break;
      }

      case "modal_closed": {
        this.context.isDrawerOpen = false;
        this.context.isModalOpen = false;
        this.context.activeFindingSeverity = null;
        break;
      }

      case "idle_started": {
        this.context.isIdle = true;
        break;
      }

      case "idle_ended": {
        this.context.isIdle = false;
        break;
      }
    }

    // Compute state transition
    const nextState = transitionCompanionState(
      this.state,
      event,
      payload,
      this.context
    );

    const stateChanged = nextState !== this.state;
    this.state = nextState;

    if (stateChanged) {
      this.notifySubscribers();
    }

    // Attempt to select and speak a dialogue line for this event
    const line = dialogueEngine.selectLineForEvent(event, payload, this.context);
    if (line) {
      this.speak(line.id, line.text, line.priority, line.actions);
    }
  }

  // Speech scheduling
  public canSpeak(priority: SpeechPriority = "normal"): boolean {
    if (this.context.isDocumentHidden) return false;
    if (companionStorage.isMuted()) return false;

    // Suppress speech while user is actively typing in an input
    if (this.context.isTyping && priority !== "priority") return false;

    // Priority overrides rate limiting
    if (priority === "priority") return true;

    // Rate limit check
    const now = Date.now();
    if (now - this.lastSpeechTime < MIN_SPEECH_INTERVAL_MS) {
      return false;
    }

    return true;
  }

  public speak(
    id: string,
    text: string,
    priority: SpeechPriority = "normal",
    actions?: CompanionAction[],
    durationMs: number = 7000
  ): boolean {
    if (!this.canSpeak(priority)) {
      return false;
    }

    this.clearSpeechDismissTimer();

    this.currentSpeech = {
      id,
      text,
      priority,
      actions,
      timestamp: Date.now(),
    };
    this.isBubbleOpen = true;
    this.lastSpeechTime = Date.now();

    companionStorage.addSeenLine(id);

    // Auto dismiss after duration if not sleeping or having actions
    if (durationMs > 0 && (!actions || actions.length === 0)) {
      this.speechDismissTimer = setTimeout(() => {
        this.dismissSpeech();
      }, durationMs);
    }

    this.notifySubscribers();
    return true;
  }

  public dismissSpeech(): void {
    this.clearSpeechDismissTimer();
    this.isBubbleOpen = false;
    this.notifySubscribers();
  }

  private clearSpeechDismissTimer(): void {
    if (this.speechDismissTimer) {
      clearTimeout(this.speechDismissTimer);
      this.speechDismissTimer = null;
    }
  }

  // Interactive user actions
  public poke(): void {
    if (this.state === "sleeping") {
      this.state = "curious";
      this.context.isIdle = false;
      this.resetIdleTimer();
      this.speak("poke_wake", "I was just resting my sensors.", "normal");
    } else {
      const poses: CompanionState[] = ["curious", "watching"];
      const nextPose = poses[Math.floor(Math.random() * poses.length)] ?? "curious";
      this.state = nextPose;
      this.notifySubscribers();
    }
  }

  public triggerAction(action: CompanionActionType, _payload?: unknown): void {
    this.dismissSpeech();
    if (
      action === "show_worst_finding" ||
      action === "copy_fix_prompt" ||
      action === "show_verification_steps"
    ) {
      companionEvents.emit("companion_action_requested", {
        actionId: action,
      });
    }
  }

  public toggleMute(): void {
    const nextMuted = !companionStorage.isMuted();
    companionStorage.setMuted(nextMuted);
    if (nextMuted) {
      this.dismissSpeech();
    }
    this.notifySubscribers();
  }

  // Subscriptions for React components
  public subscribe(subscriber: ControllerSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getSnapshot());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getSnapshot(): ControllerSnapshot {
    return {
      state: this.state,
      speech: this.currentSpeech,
      isOpen: this.isBubbleOpen && !companionStorage.isMuted(),
      isMuted: companionStorage.isMuted(),
      isSleeping: this.state === "sleeping",
      isDocked: this.context.isDrawerOpen || this.context.isModalOpen,
      isTyping: this.context.isTyping,
    };
  }

  public getContext(): Readonly<ControllerContext> {
    return this.context;
  }

  public getState(): CompanionState {
    return this.state;
  }

  private notifySubscribers(): void {
    const snapshot = this.getSnapshot();
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch (err) {
        console.error("Companion subscriber error", err);
      }
    }
  }

  public destroy(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.firstVisitTimer) clearTimeout(this.firstVisitTimer);
    this.clearSpeechDismissTimer();
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
    this.subscribers.clear();
  }
}

// Global singleton instance for the web app
export const companionController = new CompanionController();
