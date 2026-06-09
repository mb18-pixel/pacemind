"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  MessageSquare,
  Cloud,
  ChevronDown,
  Flame,
  Cpu,
  Activity,
} from "lucide-react";

// ─── Hero Headline: Wörter einzeln einblenden ───────────────────────────────
function AnimatedHeadline() {
  const line1Words = ["DEIN", "PERSÖNLICHER"];
  const line2Words = ["KI-LAUFCOACH."];

  return (
    <h1
      className="font-black tracking-tighter uppercase leading-[1.0] select-none text-center"
      style={{ fontSize: "clamp(3rem, 8vw, 7rem)" }}
    >
      {/* Erste Zeile: Weiß */}
      <span className="block whitespace-nowrap mb-2">
        {line1Words.map((word, i) => (
          <span
            key={i}
            className="inline-block animate-word opacity-0"
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            {word}
            {i < line1Words.length - 1 ? "\u00A0" : ""}
          </span>
        ))}
      </span>
      {/* Zweite Zeile: Rot */}
      <span className="block whitespace-nowrap text-[#e63228]">
        {line2Words.map((word, i) => (
          <span
            key={i}
            className="inline-block animate-word opacity-0"
            style={{ animationDelay: `${(line1Words.length + i) * 0.18}s` }}
          >
            {word}
          </span>
        ))}
      </span>
    </h1>
  );
}

// ─── Scroll-Reveal Hook ─────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}

// ─── Stat Card mit Counter-Animation ────────────────────────────────────────
function StatCard({ value, suffix, label, icon: Icon, delay = 0 }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useScrollReveal();

  useEffect(() => {
    if (!visible) return;
    const duration = 1400;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * value));
      if (p < 1) requestAnimationFrame(step);
      else setCount(value);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible, value]);

  return (
    <div
      ref={ref}
      className={`flex flex-col items-center text-center rounded-xl border border-[#222] bg-[#111]/60 p-8 backdrop-blur-sm transition-all duration-700 ease-out hover:border-[#e63228]/30 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e63228]/10">
        <Icon size={26} className="text-[#e63228]" strokeWidth={2.5} />
      </div>
      <div className="text-4xl font-black tracking-tight text-white">
        {count}
        <span className="text-[#e63228]">{suffix}</span>
      </div>
      <div className="mt-2 text-xs font-bold uppercase tracking-widest text-[#888]">
        {label}
      </div>
    </div>
  );
}

// ─── Feature Card mit Slide-Up ───────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, text, delay = 0 }) {
  const [ref, visible] = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-xl border border-[#1f1f1f] bg-[#111]/70 p-7 backdrop-blur-sm transition-all duration-700 ease-out hover:border-[#e63228]/25 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(230,50,40,0.08)] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#e63228]/12">
        <Icon size={22} className="text-[#e63228]" strokeWidth={2.5} />
      </div>
      <h3 className="mb-3 text-lg font-black uppercase tracking-tight text-white">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-[#888]">{text}</p>
    </div>
  );
}

// ─── Step Card ───────────────────────────────────────────────────────────────
function StepCard({ number, title, text, delay = 0 }) {
  const [ref, visible] = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`flex flex-col items-center p-6 text-center transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="mb-4 block font-black leading-none text-[#e63228]/20 select-none"
        style={{ fontSize: "clamp(4rem, 10vw, 7rem)" }}>
        {number}
      </span>
      <h3 className="mb-2 text-base font-black uppercase tracking-tight text-white">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-[#888]">{text}</p>
    </div>
  );
}

// ─── Main Landing Page ───────────────────────────────────────────────────────
export default function LandingPage() {
  const scrollDown = () => {
    document.getElementById("stats-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

      {/* ── Keyframe Injector ── */}
      <style>{`
        @keyframes word-fade {
          0%   { opacity: 0; filter: blur(6px); transform: translateY(24px); }
          100% { opacity: 1; filter: blur(0);   transform: translateY(0); }
        }
        .animate-word {
          animation: word-fade 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50%       { opacity: 0.32; transform: scale(1.12); }
        }
        .glow-blob {
          animation: glow-pulse 9s ease-in-out infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(6px); }
        }
        .bounce-slow { animation: bounce-slow 1.8s ease-in-out infinite; }
      `}</style>

      {/* ══════════════════════════════════════════════════
          SECTION 1 – HERO
      ══════════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">

        {/* Animated red glowing background */}
        <div className="pointer-events-none absolute inset-0 select-none">
          {/* Main center glow */}
          <div className="glow-blob absolute bottom-[-10%] right-[-5%] h-[620px] w-[620px] rounded-full bg-[#e63228] blur-[160px]" />
          {/* Secondary top-left ambient */}
          <div className="absolute top-[-5%] left-[-8%] h-[380px] w-[380px] rounded-full bg-[#e63228]/6 blur-[120px]" />
          {/* Subtle center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[#e63228]/5 blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-28 text-center">
          <AnimatedHeadline />

          <p
            className="mt-8 max-w-xl text-base font-medium text-[#aaa] sm:text-lg animate-word opacity-0"
            style={{ animationDelay: "0.85s" }}
          >
            Wissenschaftlich fundiert. Kostenlos. Für die PerformanceProtokoll Community.
          </p>

          <div
            className="mt-10 animate-word opacity-0"
            style={{ animationDelay: "1.05s" }}
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 rounded-lg bg-[#e63228] px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition-all duration-300 hover:bg-[#ff3b30] hover:scale-[1.03] active:scale-[0.98] hover:shadow-[0_0_40px_rgba(230,50,40,0.65)]"
            >
              Jetzt kostenlos starten
              <ArrowRight
                className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.5}
              />
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={scrollDown}
          aria-label="Weiter scrollen"
          className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[#555] transition-colors hover:text-white focus:outline-none"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Mehr</span>
          <ChevronDown className="h-5 w-5 text-[#e63228] bounce-slow" strokeWidth={2.5} />
        </button>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 2 – SOCIAL PROOF
      ══════════════════════════════════════════════════ */}
      <section
        id="stats-section"
        className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-24 scroll-mt-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="mb-14 text-center text-xs font-bold uppercase tracking-[0.25em] text-[#e63228]">
            Bereits von der PerformanceProtokoll Community genutzt
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <StatCard value={100} suffix="%" label="Kostenlos" icon={Flame} delay={0} />
            <StatCard value={24}  suffix="/7" label="KI-Coach" icon={Cpu}  delay={120} />
            <StatCard value={100} suffix="%" label="Wissenschaftlich fundiert" icon={Activity} delay={240} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3 – FEATURES
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
              Dein Laufpartner auf einem neuen Level
            </h2>
            <p className="mt-4 text-sm text-[#666] max-w-lg mx-auto">
              Moderne KI trifft auf Sportwissenschaft – für smartes, effizientes Training.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <FeatureCard
              icon={Calendar}
              title="Dein Plan. Dein Tempo."
              text="Der Coach erstellt dir einen wissenschaftlich fundierten Trainingsplan – angepasst an dein Ziel, deine Zeit und dein Fitnesslevel."
              delay={0}
            />
            <FeatureCard
              icon={MessageSquare}
              title="Ein Coach der zuhört."
              text="Sag dem Coach wann du müde bist, wann du keine Zeit hast oder wann du einen PR willst. Er passt alles automatisch an."
              delay={130}
            />
            <FeatureCard
              icon={Cloud}
              title="Training bei jedem Wetter."
              text="PaceMind kennt das Wetter an deinem Standort und plant deine Einheiten entsprechend."
              delay={260}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4 – HOW IT WORKS
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
              So funktioniert es
            </h2>
            <p className="mt-4 text-sm text-[#666]">
              In drei Schritten zu deiner neuen Bestzeit.
            </p>
          </div>

          {/* Connector line (desktop only) */}
          <div className="relative grid grid-cols-1 gap-0 md:grid-cols-3">
            <div className="pointer-events-none absolute top-[3.5rem] left-[16.67%] right-[16.67%] hidden h-px bg-gradient-to-r from-transparent via-[#e63228]/20 to-transparent md:block" />
            <StepCard number="01" title="Profil erstellen"    text="Gib dein Ziel, Level und Trainingszeiten ein."              delay={0}   />
            <StepCard number="02" title="Plan erhalten"       text="Der Coach erstellt deinen persönlichen Plan."               delay={140} />
            <StepCard number="03" title="Trainieren & wachsen" text="Tracke deine Läufe, der Coach passt sich an."             delay={280} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 5 – CTA
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] px-4 pb-32 pt-24">
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-2xl border border-[#e63228]/20 bg-[#0f0f0f] p-10 text-center shadow-[0_0_80px_rgba(230,50,40,0.07)] md:p-20">
            {/* Inner glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e63228]/40 to-transparent" />
            <div className="pointer-events-none absolute -top-1/2 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-[#e63228]/7 blur-[100px]" />

            <div className="relative z-10">
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white sm:text-5xl md:text-6xl">
                Bereit zu laufen?
              </h2>
              <p className="mt-4 text-base font-medium text-[#888] sm:text-lg">
                Kostenlos. Kein App Store. Direkt im Browser.
              </p>

              <div className="mt-10">
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2.5 rounded-lg bg-[#e63228] px-10 py-5 text-sm font-black uppercase tracking-widest text-white transition-all duration-300 hover:bg-[#ff3b30] hover:scale-[1.03] active:scale-[0.98] hover:shadow-[0_0_50px_rgba(230,50,40,0.7)]"
                >
                  Jetzt starten – kostenlos
                  <ArrowRight
                    className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={2.5}
                  />
                </Link>
              </div>

              <div className="mt-12 flex items-center justify-center gap-6 text-[11px] font-bold uppercase tracking-widest text-[#444]">
                <Link href="/impressum" className="transition-colors hover:text-[#e63228]">
                  Impressum
                </Link>
                <span className="h-3 w-px bg-[#2a2a2a]" />
                <Link href="/datenschutz" className="transition-colors hover:text-[#e63228]">
                  Datenschutz
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
