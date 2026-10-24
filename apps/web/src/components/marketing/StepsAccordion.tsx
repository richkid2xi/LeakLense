import { useRef, type KeyboardEvent } from "react";
import { MaterialIcon } from "../common/MaterialIcon";
import { HOW_IT_WORKS_STEPS } from "./howItWorksContent";

interface StepsAccordionProps {
  activeStep: number;
  onSelectStep: (stepIndex: number) => void;
}

export function StepsAccordion({ activeStep, onSelectStep }: StepsAccordionProps) {
  const headerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    const total = HOW_IT_WORKS_STEPS.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % total;
      headerRefs.current[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (index - 1 + total) % total;
      headerRefs.current[prevIndex]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      headerRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      headerRefs.current[total - 1]?.focus();
    }
  };

  return (
    <div className="step-accordion" role="region" aria-label="Process steps accordion">
      {HOW_IT_WORKS_STEPS.map((step, index) => {
        const isOpen = activeStep === index;

        return (
          <div
            key={step.id}
            className={`step-accordion-item ${isOpen ? "is-open" : ""}`}
          >
            <button
              ref={(el) => {
                headerRefs.current[index] = el;
              }}
              type="button"
              id={`step-accordion-header-${step.id}`}
              className={`step-accordion-trigger ${isOpen ? "is-active" : ""}`}
              aria-expanded={isOpen}
              aria-controls={`step-accordion-panel-${step.id}`}
              onClick={() => {
                // Radio style: clicking closed item opens it; clicking open item does nothing
                if (!isOpen) {
                  onSelectStep(index);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <span className="step-accordion-num">{step.number}</span>
              <strong className="step-accordion-title">{step.title}</strong>
              <span className="step-accordion-icon" aria-hidden="true">
                <MaterialIcon>{isOpen ? "remove" : "add"}</MaterialIcon>
              </span>
            </button>

            <div
              id={`step-accordion-panel-${step.id}`}
              role="region"
              aria-labelledby={`step-accordion-header-${step.id}`}
              className="step-accordion-body"
            >
              <div className="step-accordion-body-inner">
                <p className="step-accordion-desc">{step.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
