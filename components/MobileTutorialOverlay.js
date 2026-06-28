"use client";

import { useEffect, useState } from "react";

export default function MobileTutorialOverlay({ open, stepIndex, steps, onNext, onLater }) {
  const [highlightRect, setHighlightRect] = useState(null);
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

  useEffect(() => {
    if (!open || !steps || steps.length === 0) return;
    const currentStep = steps[stepIndex];
    
    if (currentStep?.target) {
      const el = document.querySelector(currentStep.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHighlightRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        return;
      }
    }
    setHighlightRect(null);
  }, [open, steps, stepIndex]);

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

  const isBottomHalf = highlightRect && highlightRect.top > window.innerHeight / 2;
  const cardAlignment = highlightRect ? (isBottomHalf ? "items-start pt-24" : "items-center") : "items-center";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.85)",
      }}
      className={`flex justify-center p-4 animate-in fade-in duration-300 ${cardAlignment}`}
    >
      {highlightRect && (
        <div
          style={{
            position: "fixed",
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            border: "2px solid #e63228",
            borderRadius: "12px",
            boxShadow: "0 0 0 4px rgba(230, 50, 40, 0.25)",
            pointerEvents: "none",
            zIndex: 9998,
            animation: "pulse-ring 1.5s ease-in-out infinite",
          }}
        />
      )}
      <div className="bg-surface border border-border rounded-xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center shadow-xl relative z-[10000]">
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
