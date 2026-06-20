"use client";

import { useEffect, useMemo, useState } from "react";

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function computeSpotlightRect(element, padding = 8) {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  const left = clamp(r.left - padding, 8, window.innerWidth - 8);
  const top = clamp(r.top - padding, 8, window.innerHeight - 8);
  const right = clamp(r.right + padding, 8, window.innerWidth - 8);
  const bottom = clamp(r.bottom + padding, 8, window.innerHeight - 8);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    radius: 10,
  };
}

export default function ChatTutorialOverlay({
  open,
  stepIndex,
  steps,
  onSkip,
  onNext,
  onLater,
}) {
  const total = steps.length;
  const step = steps[stepIndex];

  const [spotlight, setSpotlight] = useState(null);

  const progressPct = useMemo(() => {
    if (!total) return 0;
    return ((stepIndex + 1) / total) * 100;
  }, [stepIndex, total]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

    let raf = 0;
    let targetEl = null;

    function update() {
      if (!open) return;
      if (!step?.target) {
        Promise.resolve().then(() => setSpotlight(null));
        return;
      }

      const el = document.querySelector(step.target);
      targetEl = el;
      if (!el) {
        Promise.resolve().then(() => setSpotlight(null));
        return;
      }
      const next = computeSpotlightRect(el, 8);
      Promise.resolve().then(() => setSpotlight(next));
    }

    // Scroll to target (wenn vorhanden)
    if (step?.target) {
      const el = document.querySelector(step.target);
      if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    // Initial
    update();

    // Nach kurzer Zeit nochmal (nach Smooth-Scroll)
    const t = window.setTimeout(update, 350);

    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      targetEl = null;
    };
  }, [open, step?.target]);

  if (!open) return null;

  const isLast = stepIndex === total - 1;

  return (
    <div className="fixed inset-0" style={{ zIndex: 60 }}>
      {/* Overlay/Spotlight */}
      {spotlight ? (
        <div
          className="fixed pointer-events-none border-2 border-accent shadow-[0_0_18px_rgba(230,50,40,0.45)]"
          style={{
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: spotlight.radius,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.8), 0 0 18px rgba(230,50,40,0.45)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/80" />
      )}

      {/* Progress */}
      <div className="fixed left-0 right-0 top-0" style={{ zIndex: 60 }}>
        <div className="h-1 bg-white/15">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Skip */}
      <div className="fixed right-4 top-4" style={{ zIndex: 60 }}>
        <button
          type="button"
          onClick={onSkip}
          className="touch-target rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/15 min-h-[44px]"
        >
          Überspringen
        </button>
      </div>

      {/* Card */}
      <div className="fixed bottom-6 left-0 right-0 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]" style={{ zIndex: 60 }}>
        <div className="mx-auto w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-600">
            Schritt {stepIndex + 1}/{total}
          </p>
          <p className="mt-3 whitespace-pre-line text-base font-semibold text-neutral-900">
            {step?.text}
          </p>

          {/* Example message chips for chat step */}
          {step?.chips && (
            <div className="mt-4 flex flex-wrap gap-2">
              {step.chips.map((chip, idx) => (
                <span
                  key={idx}
                  className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* Final step: Logo and big button */}
          {step?.isFinal && (
            <div className="mt-6 flex flex-col items-center">
              <div className="mb-4 text-4xl font-black tracking-tight text-[#e63228]">
                ASCEND
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {isLast ? (
              <>
                <button
                  type="button"
                  onClick={onLater}
                  className="touch-target rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 min-h-[44px]"
                >
                  Später
                </button>
                <button
                  type="button"
                  onClick={onLater}
                  className="touch-target rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 min-h-[44px]"
                >
                  Training starten
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="touch-target rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 min-h-[44px]"
              >
                Weiter →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

