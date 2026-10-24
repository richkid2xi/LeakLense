import { useState, useEffect, useRef, useCallback } from "react";
import { StepsAccordion } from "./StepsAccordion";
import { StepCard } from "./StepCard";
import { HOW_IT_WORKS_STEPS } from "./howItWorksContent";

export function StepsSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [displayedStep, setDisplayedStep] = useState(0);
  const [flipSpeed, setFlipSpeed] = useState<"normal" | "fast" | "instant">("normal");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const targetStepRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAnnouncedRef = useRef(false);

  // Check prefers-reduced-motion
  const getPrefersReducedMotion = useCallback(() => {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Process next step in the flip sequence towards targetStepRef
  const processNextFlip = useCallback(() => {
    const target = targetStepRef.current;

    setDisplayedStep((current) => {
      if (current === target) {
        isTransitioningRef.current = false;
        return current;
      }

      const diff = Math.abs(target - current);
      const isMultiStep = diff > 1;
      const speed = isMultiStep ? "fast" : "normal";
      const duration = isMultiStep ? 350 : 650;

      setFlipSpeed(speed);

      const nextStep = target > current ? current + 1 : current - 1;

      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      stepTimerRef.current = setTimeout(() => {
        processNextFlip();
      }, duration);

      return nextStep;
    });
  }, []);

  const handleSelectStep = useCallback(
    (newStep: number) => {
      if (newStep < 0 || newStep >= HOW_IT_WORKS_STEPS.length) return;

      setActiveStep(newStep);
      targetStepRef.current = newStep;

      // Announce polite live message for screen readers (skip initial render)
      if (hasAnnouncedRef.current) {
        const stepMeta = HOW_IT_WORKS_STEPS[newStep];
        if (stepMeta) {
          setLiveAnnouncement(`Step ${newStep + 1} of ${HOW_IT_WORKS_STEPS.length}: ${stepMeta.title}`);
        }
      } else {
        hasAnnouncedRef.current = true;
      }

      if (getPrefersReducedMotion()) {
        setFlipSpeed("instant");
        setDisplayedStep(newStep);
        isTransitioningRef.current = false;
        return;
      }

      if (!isTransitioningRef.current) {
        isTransitioningRef.current = true;
        processNextFlip();
      }
    },
    [getPrefersReducedMotion, processNextFlip]
  );

  // Initial load flag
  useEffect(() => {
    const timer = setTimeout(() => {
      hasAnnouncedRef.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, []);

  const handleScanApp = () => {
    const urlInput = document.querySelector(".url-form input") as HTMLInputElement | null;
    const heroSection = document.getElementById("top");

    if (urlInput) {
      urlInput.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        urlInput.focus({ preventScroll: true });
      }, 500);
    } else if (heroSection) {
      heroSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="process grid-section" id="how">
      {/* Screen reader polite live region for step changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <div className="process-copy">
        <p className="process-microlabel">03 / HOW IT WORKS</p>
        <h2 className="process-heading">Three steps, five minutes of your time.</h2>

        <StepsAccordion activeStep={activeStep} onSelectStep={handleSelectStep} />
      </div>

      <div
        className={`card-stack book-perspective speed-${flipSpeed}`}
        aria-label="Process steps interactive book illustration"
      >
        {HOW_IT_WORKS_STEPS.map((step, idx) => {
          let cardStateClass = "";
          let cardZIndex = 1;

          if (idx < displayedStep) {
            // Turned page (flipped to the left)
            cardStateClass = "is-flipped-left";
            cardZIndex = 1;
          } else if (idx === displayedStep) {
            // Active front page
            cardStateClass = "is-active";
            cardZIndex = 10;
          } else if (idx === displayedStep + 1) {
            // Next page peeking
            cardStateClass = "is-peek-1";
            cardZIndex = 5;
          } else {
            // Farther page peeking
            cardStateClass = "is-peek-2";
            cardZIndex = 2;
          }

          return (
            <div
              key={step.id}
              className={`step-page-card ${cardStateClass}`}
              style={{ zIndex: cardZIndex }}
              aria-hidden={idx !== activeStep}
            >
              <StepCard
                step={step}
                isActive={idx === activeStep}
                onNext={() => handleSelectStep(activeStep + 1)}
                onBack={() => handleSelectStep(activeStep - 1)}
                onScanApp={handleScanApp}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
