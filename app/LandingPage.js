"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  MessageSquare,
  Cloud,
  ChevronDown,
  Flame,
  Cpu,
  Activity,
  Brain,
  AlertTriangle,
} from "lucide-react";

// ─── Hero Headline: Wörter einzeln einblenden ───────────────────────────────
function AnimatedHeadline() {
  const line1Words = ["DEIN", "PERSÖNLICHER"];
  const line2Words = ["KI-LAUFCOACH."];

  return (
    <h1
      className="font-black tracking-tighter uppercase leading-[1.0] select-none text-center"
      style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)" }}
    >
      {/* Erste Zeile: Weiß */}
      <span className="block mb-2">
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
function useScrollReveal(threshold = 0.2) {
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
      className={`flex flex-col items-center text-center rounded-xl border border-[#222] bg-[#111]/60 p-6 md:p-8 backdrop-blur-sm transition-all duration-700 ease-out hover:border-[#e63228]/30 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-[#e63228]/10">
        <Icon size={26} className="text-[#e63228]" strokeWidth={2.5} />
      </div>
      <div className="text-3xl md:text-4xl font-black tracking-tight text-white">
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
      className={`flex flex-col rounded-xl border border-[#1f1f1f] bg-[#111]/70 p-5 md:p-7 backdrop-blur-sm transition-all duration-700 ease-out hover:border-[#e63228]/25 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(230,50,40,0.08)] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-5 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-[#e63228]/12">
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
      className={`flex flex-col items-center p-4 md:p-6 text-center transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="mb-4 block font-black leading-none text-[#e63228]/20 select-none"
        style={{ fontSize: "clamp(3rem, 8vw, 6rem)" }}>
        {number}
      </span>
      <h3 className="mb-2 text-base font-black uppercase tracking-tight text-white">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-[#888]">{text}</p>
    </div>
  );
}

// ─── Chat Mockup ───────────────────────────────────────────────────────────────
function ChatMockup({ type, messages, delay = 0 }) {
  const [ref, visible] = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
    <div
      className={`rounded-xl border ${
        type === "ascend"
          ? "border-[#e63228]/30 bg-[#0f0f0f] border-l-4 border-l-[#e63228]"
          : "border-[#1a1a1a] bg-[#0f0f0f]"
      } p-5 h-full`}
    >
      <div className={`text-xs font-bold uppercase tracking-wider mb-4 ${
        type === "ascend" ? "text-[#e63228]" : "text-[#666]"
      }`}>
        {type === "ascend" ? "⚡ ASCEND" : "💬 Herrkömmliche KIs"}
      </div>
      <div className="space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-sm ${
              msg.role === "user"
                ? "bg-[#1a1a1a] text-[#aaa]"
                : type === "ascend"
                ? "bg-[#e63228]/10 text-white border border-[#e63228]/20"
                : "bg-[#1f1f1f] text-[#888]"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

// ─── Key Difference Card ───────────────────────────────────────────────────────
function KeyDifferenceCard({ icon: Icon, title, text, delay = 0 }) {
  const [ref, visible] = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-xl border border-[#1f1f1f] bg-[#111]/70 p-6 md:p-8 backdrop-blur-sm transition-all duration-700 ease-out hover:border-[#e63228]/25 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-6 flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl bg-[#e63228]/12">
        <Icon size={28} className="text-[#e63228]" strokeWidth={2.5} />
      </div>
      <h3 className="mb-4 text-xl font-black uppercase tracking-tight text-white">
        {title}
      </h3>
      <p className="text-base leading-relaxed text-[#888]">{text}</p>
    </div>
  );
}

// ─── Quote Section ─────────────────────────────────────────────────────────────
function QuoteSection() {
  const [ref, visible] = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`text-center transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="relative">
        <span
          className="absolute -top-6 -left-3 text-6xl md:text-[8rem] font-black text-[#e63228]/20 leading-none select-none"
          style={{ fontFamily: "serif" }}
        >
          "
        </span>
        <blockquote
          className="relative text-2xl md:text-4xl font-black leading-tight text-white max-w-4xl mx-auto"
          style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)" }}
        >
          Der Unterschied ist wie zwischen einem Google-Suchergebnis und einem Physiotherapeuten der dich seit Jahren kennt.
        </blockquote>
        <cite className="block mt-6 text-sm font-bold uppercase tracking-widest text-[#666] not-italic">
          – PerformanceProtokoll
        </cite>
      </div>
    </div>
  );
}

// ─── Main Landing Page ───────────────────────────────────────────────────────
export default function LandingPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);


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

        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/running-poster.jpg')",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.5) 50%, rgba(10,10,10,0.9) 100%)",
            zIndex: 10,
          }}
        />

        {/* Animated red glowing background */}
        <div className="pointer-events-none absolute inset-0 select-none" style={{ zIndex: 10 }}>
          {/* Main center glow */}
          <div className="glow-blob absolute bottom-[-10%] right-[-5%] h-[400px] w-[400px] md:h-[620px] md:w-[620px] rounded-full bg-[#e63228] blur-[120px] md:blur-[160px]" />
          {/* Secondary top-left ambient */}
          <div className="absolute top-[-5%] left-[-8%] h-[250px] w-[250px] md:h-[380px] md:w-[380px] rounded-full bg-[#e63228]/6 blur-[80px] md:blur-[120px]" />
          {/* Subtle center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] md:h-[500px] md:w-[500px] rounded-full bg-[#e63228]/5 blur-[60px] md:blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-20 md:pb-24 md:pt-28 text-center" style={{ zIndex: 10 }}>
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
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 px-4 py-3 text-[#555] transition-colors hover:text-white focus:outline-none" style={{ zIndex: 10 }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Mehr</span>
          <ChevronDown className="h-5 w-5 text-[#e63228] bounce-slow" strokeWidth={2.5} />
        </button>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3 – CHAT VERGLEICH
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white mb-4">
              Der Unterschied im Detail
            </h2>
          </div>

          {/* Desktop: Side by side */}
          <div className="hidden md:grid md:grid-cols-2 gap-8">
            <ChatMockup
              type="generic"
              delay={0}
              messages={[
                { role: "user", content: "Ich will einen 10K in 45 Min laufen" },
                { role: "assistant", content: "Super Ziel! Hier sind einige allgemeine Tipps für dein 10K Training:\n1. Laufe 3-4 mal pro Woche\n2. Steigere dein Volumen langsam\n3. Mache Intervalltraining..." },
              ]}
            />
            <ChatMockup
              type="ascend"
              delay={100}
              messages={[
                { role: "user", content: "Ich will einen 10K in 45 Min laufen" },
                { role: "assistant", content: "Dein aktueller VDOT: 38.\nZiel-VDOT für 45 Min 10K: 46.\nDas sind +8 Punkte in 18 Wochen – machbar.\n\nDiese Woche: 28km, 80% Zone 2.\nMorgen: 8km @ 6:25/km (119-131 bpm).\nDonnerstag: 5x800m @ 5:10/km (143-155 bpm).\nSamstag: 12km Langer Lauf @ 6:50/km.\n\nDein Puls-Limit morgen: unter 131 bpm.\nBeim letzten Lauf warst du bei 148 – das war zu schnell für Zone 2." },
              ]}
            />
          </div>

          {/* Mobile: Stacked */}
          <div className="md:hidden space-y-8">
            <ChatMockup
              type="generic"
              delay={0}
              messages={[
                { role: "user", content: "Ich will einen 10K in 45 Min laufen" },
                { role: "assistant", content: "Super Ziel! Hier sind einige allgemeine Tipps für dein 10K Training:\n1. Laufe 3-4 mal pro Woche\n2. Steigere dein Volumen langsam\n3. Mache Intervalltraining..." },
              ]}
            />
            <ChatMockup
              type="ascend"
              delay={100}
              messages={[
                { role: "user", content: "Ich will einen 10K in 45 Min laufen" },
                { role: "assistant", content: "Dein aktueller VDOT: 38.\nZiel-VDOT für 45 Min 10K: 46.\nDas sind +8 Punkte in 18 Wochen – machbar.\n\nDiese Woche: 28km, 80% Zone 2.\nMorgen: 8km @ 6:25/km (119-131 bpm).\nDonnerstag: 5x800m @ 5:10/km (143-155 bpm).\nSamstag: 12km Langer Lauf @ 6:50/km.\n\nDein Puls-Limit morgen: unter 131 bpm.\nBeim letzten Lauf warst du bei 148 – das war zu schnell für Zone 2." },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4 – DREI KERNUNTERSCHIEDE
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white mb-4">
              Die drei Kernunterschiede
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-3">
            <KeyDifferenceCard
              icon={Brain}
              title="Herkömmliche KIs haben kein Gedächtnis."
              text="Jedes Mal wenn du herkömmliche KIs nach deinem Training fragst, fängst du von vorne an. Kein Kontext, keine Historie, keine Entwicklung. Ascend erinnert sich an jeden Lauf, jeden Schmerz, jeden Fortschritt."
              delay={0}
            />
            <KeyDifferenceCard
              icon={Activity}
              title="Herkömmliche KIs schätzen. Ascend berechnet."
              text="Generische KI gibt dir Tipps aus dem Internet. Ascend berechnet deine persönlichen Herzfrequenzzonen nach Karvonen, deine Trainingspaces nach Jack Daniels VDOT und deine Belastungssteuerung nach ACWR. Das ist der Unterschied zwischen einem Google-Suchergebnis und einem echten Coach."
              delay={130}
            />
            <KeyDifferenceCard
              icon={AlertTriangle}
              title="Herkömmliche KIs sagen dir was du hören willst."
              text="Bittest du herkömmliche KIs um einen Marathon-Plan für nächsten Monat? Es erstellen dir einen. Ascend sagt dir: 'Das ist in 4 Wochen nicht machbar ohne Verletzungsrisiko. Ich empfehle 20 Wochen.' Ein echter Coach schützt dich vor dir selbst."
              delay={260}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 5 – SOCIAL PROOF QUOTE
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <QuoteSection />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 6 – SOCIAL PROOF
      ══════════════════════════════════════════════════ */}
      <section
        id="stats-section"
        className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-16 md:py-24 scroll-mt-20"
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
          SECTION 7 – FEATURES
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
              Dein Laufpartner auf einem neuen Level
            </h2>
            <p className="mt-4 text-sm text-[#666] max-w-lg mx-auto">
              Moderne KI trifft auf Sportwissenschaft – für smartes, effizientes Training.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
            <FeatureCard
              icon={Activity}
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
              text="Ascend kennt das Wetter an deinem Standort und plant deine Einheiten entsprechend."
              delay={260}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 8 – HOW IT WORKS
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-16 md:py-24">
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
          SECTION 9 – CTA
      ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#1a1a1a] px-4 pb-20 pt-16 md:pb-32 md:pt-24">
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-2xl border border-[#e63228]/20 bg-[#0f0f0f] p-6 text-center shadow-[0_0_80px_rgba(230,50,40,0.07)] md:p-10 md:py-10">
            {/* Inner glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e63228]/40 to-transparent" />
            <div className="pointer-events-none absolute -top-1/2 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-[#e63228]/7 blur-[100px]" />

            <div className="relative" style={{ zIndex: 10 }}>
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
                <Link href="/impressum" className="px-3 py-2 transition-colors hover:text-[#e63228]">
                  Impressum
                </Link>
                <span className="h-3 w-px bg-[#2a2a2a]" />
                <Link href="/datenschutz" className="px-3 py-2 transition-colors hover:text-[#e63228]">
                  Datenschutz
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <footer className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-[#444]">
              <Link href="/impressum" className="px-3 py-2 transition-colors hover:text-[#e63228]">
                Impressum
              </Link>
              <span className="h-3 w-px bg-[#2a2a2a]" />
              <Link href="/datenschutz" className="px-3 py-2 transition-colors hover:text-[#e63228]">
                Datenschutz
              </Link>
            </div>
            <p className="text-xs text-[#555]">
              © 2026 Ascend by PerformanceProtokoll
            </p>
            <p className="text-[10px] text-[#444] max-w-md">
              Ascend ersetzt keine medizinische Beratung. Bei gesundheitlichen Fragen konsultiere bitte einen Arzt oder Physiotherapeuten.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
