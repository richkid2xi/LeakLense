export type SeverityLevel = "Critical" | "High" | "Medium" | "Low";

export interface CompanionEventPayloads {
  route_changed: {
    route: "marketing" | "auth" | "app";
    screen?: string;
  };
  section_in_view: {
    sectionId: string;
    heading?: string;
  };
  scan_started: {
    url: string;
    builder?: string;
  };
  scan_step_changed: {
    stepIndex: number;
    stepName: string;
    stepMessage?: string;
  };
  scan_finished: {
    severityCounts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    score: number;
    couldNotTestCount: number;
    clean: boolean;
  };
  scan_failed: {
    reason?: string;
  };
  verification_started: {
    method: "dns" | "meta" | "file";
    domain: string;
  };
  verification_succeeded: {
    domain: string;
  };
  verification_failed: {
    reason: string;
  };
  finding_opened: {
    id: string | number;
    title: string;
    severity: SeverityLevel;
    category?: string;
    where?: string;
  };
  fix_prompt_copied: {
    findingId?: string | number;
  };
  finding_status_changed: {
    findingId: string | number;
    newStatus: string;
  };
  idle_started: {
    idleSeconds: number;
  };
  idle_ended: Record<string, never>;
  error_shown: {
    message: string;
    context?: string;
  };
  user_typing_started: Record<string, never>;
  user_typing_ended: Record<string, never>;
  modal_opened: {
    modalType: string;
  };
  modal_closed: Record<string, never>;
  companion_action_requested: {
    actionId: "show_worst_finding" | "copy_fix_prompt" | "show_verification_steps";
  };
}

export type CompanionEventKey = keyof CompanionEventPayloads;

type Handler<T> = (payload: T) => void;
type AnyHandler = (event: CompanionEventKey, payload: unknown) => void;

class TypedEventBus {
  private listeners = new Map<CompanionEventKey, Set<Handler<any>>>();
  private anyListeners = new Set<AnyHandler>();

  emit<K extends CompanionEventKey>(event: K, payload: CompanionEventPayloads[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[CompanionEvents] Error in handler for event "${event}":`, err);
        }
      }
    }

    for (const anyHandler of this.anyListeners) {
      try {
        anyHandler(event, payload);
      } catch (err) {
        console.error(`[CompanionEvents] Error in wildcard handler for event "${event}":`, err);
      }
    }
  }

  on<K extends CompanionEventKey>(
    event: K,
    handler: Handler<CompanionEventPayloads[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(handler);

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  onAny(handler: AnyHandler): () => void {
    this.anyListeners.add(handler);
    return () => {
      this.anyListeners.delete(handler);
    };
  }

  clear(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }
}

export const companionEvents = new TypedEventBus();
