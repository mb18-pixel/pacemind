"use client";

import { useEffect } from "react";

export default function MobileTutorialOverlay({ open, stepIndex, steps, onNext, onLater }) {
  // Prevent scrolling while overlay is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !steps || steps.length === 0) return null;

  const currentStep = steps[stepIndex];
  if (!currentStep) return null;

  const isLastStep = stepIndex === steps.length - 1;

  function handleNext() {
    if (isLastStep) {
      onLater(); // onLater closes the tutorial and finishes it
    } else {
      onNext();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.85)",
      }}
      className="flex items-center justify-center p-4 animate-in fade-in duration-300"
    >
      <div className="bg-surface border border-border rounded-xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center shadow-xl">
        <div className="text-5xl mb-6">{currentStep.emoji}</div>
        
        <h2 className="font-extrabold uppercase text-xl text-text mb-3 tracking-tight">
          {currentStep.title}
        </h2>
        
        <p className="text-text-muted text-sm leading-relaxed mb-8">
          {currentStep.text}
        </p>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-2 rounded-full transition-colors ${
                idx === stepIndex ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>
        
        <button
          onClick={handleNext}
          className="btn-primary w-full"
        >
          {isLastStep ? "Los geht's!" : "Weiter"}
        </button>
      </div>
    </div>
  );
}
