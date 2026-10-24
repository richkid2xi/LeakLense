import { useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import {
  companionController,
  type ControllerSnapshot,
  type CompanionActionType,
} from "../../lib/companion/controller";

export function Companion({ message }: { message?: string }) {
  const [snapshot, setSnapshot] = useState<ControllerSnapshot>(() =>
    companionController.getSnapshot()
  );

  useEffect(() => {
    return companionController.subscribe(setSnapshot);
  }, []);

  // Listen for Escape key to dismiss bubble
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && snapshot.isOpen) {
        companionController.dismissSpeech();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [snapshot.isOpen]);

  const activeText = snapshot.speech?.text || message;
  const isBubbleVisible = snapshot.isOpen && Boolean(activeText) && !snapshot.isMuted;

  // Icon mapping according to companion state
  const getIconForState = () => {
    switch (snapshot.state) {
      case "curious":
        return "search";
      case "watching":
        return "visibility";
      case "working":
        return "sync";
      case "relieved":
        return "check";
      case "concerned":
        return "priority_high";
      case "serious":
        return "shield";
      case "sleeping":
        return "bedtime";
      case "celebrating":
        return "auto_awesome";
      case "idle":
      default:
        return "smart_toy";
    }
  };

  const handleBotClick = () => {
    if (snapshot.isSleeping) {
      companionController.poke();
    } else if (isBubbleVisible) {
      companionController.dismissSpeech();
    } else {
      companionController.poke();
    }
  };

  const handleActionClick = (action: CompanionActionType, payload?: unknown) => {
    companionController.triggerAction(action, payload);
  };

  return (
    <div
      className={`companion companion--${snapshot.state} ${
        isBubbleVisible ? "open" : ""
      } ${snapshot.isDocked ? "companion--docked" : ""}`}
    >
      {isBubbleVisible && (
        <div
          className="companion-note"
          role="region"
          aria-label="LeakLens companion dialogue"
          aria-live={snapshot.speech?.priority === "priority" ? "polite" : "off"}
          aria-atomic="true"
        >
          <div className="companion-note-header">
            <button
              type="button"
              className="companion-icon-btn"
              onClick={() => companionController.toggleMute()}
              aria-label={snapshot.isMuted ? "Unmute companion" : "Hush companion"}
              title={snapshot.isMuted ? "Unmute" : "Hush"}
            >
              <MaterialIcon>
                {snapshot.isMuted ? "volume_off" : "volume_up"}
              </MaterialIcon>
            </button>
            <button
              type="button"
              className="companion-icon-btn"
              onClick={() => companionController.dismissSpeech()}
              aria-label="Dismiss message"
              title="Dismiss"
            >
              <MaterialIcon>close</MaterialIcon>
            </button>
          </div>

          <p>{activeText}</p>

          {snapshot.speech?.actions && snapshot.speech.actions.length > 0 && (
            <div className="companion-actions">
              {snapshot.speech.actions.map((act, index) => (
                <button
                  key={`${act.action}-${index}`}
                  type="button"
                  className="companion-action-btn"
                  onClick={() => handleActionClick(act.action, act.payload)}
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={`companion-bot companion-bot--${snapshot.state}`}
        onClick={handleBotClick}
        aria-label={`LeakLens companion (${snapshot.state}). Click to interact.`}
        title={`Companion: ${snapshot.state}`}
      >
        <MaterialIcon>{getIconForState()}</MaterialIcon>
        <i />
      </button>
    </div>
  );
}
