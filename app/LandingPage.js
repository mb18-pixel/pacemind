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

// Individual letter animation wrapper
function AnimatedLetters({ text }) {
  const line1 = "DEIN PERSÖNLICHER".split("");
  const line2 = "KI-LAUFCOACH.".split("");

  return (
    <h1
      className="text-center font-black tracking-tighter uppercase leading-none select-none"
      style={{ fontSize: "clamp(3rem, 8vw, 7rem)" }}
    >
      <span className="block mb-1 overflow-hidden py-1 whitespace-nowrap">
        {line1.map((char, index) => (
          <span
            key={index}
            className="inline-block animate-letter opacity-0 fill-mode-forwards"
            style={{
              animationDelay: `${index * 0.03}s`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
      <span className="block overflow-hidden py-1 text-accent whitespace-nowrap">
        {line2.map((char, index) => (
          <span
            key={index}
            className="inline-block animate-letter opacity-0 fill-mode-forwards"
            style={{
              animationDelay: `${(line1.length + index) * 0.03}s`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
    </h1>
  );
}

// Stat Card with smooth scroll counter animation
function StatCard({ value, suffix, label, delay = 0, icon: Icon }) {
  const [count, setCount] = useState(0);
  const elementRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTimestamp = null;
          const duration = 1500; // ms
          const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3); // cubic ease-out
            setCount(Math.floor(easedProgress * value));
            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              setCount(value);
            }
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [value, hasAnimated]);

  return (
    <div
      ref={elementRef}
      className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-elevated/40 p-6 text-center transition-all duration-300 hover:border-accent/30 hover:bg-surface-elevated/60 shadow-lg hover:shadow-accent/5 backdrop-blur-sm"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <span className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
        {count}
        <span className="text-accent">{suffix}</span>
      </span>
      <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  );
}

// Feature Card with slide-in animation
function FeatureCard({ icon: Icon, title, text, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-xl border border-border bg-surface/50 p-6 transition-all duration-700 ease-out transform backdrop-blur-sm ${
        isVisible
          ? "opacity-100 translate-y-0 filter blur-0"
          : "opacity-0 translate-y-12 filter blur-[2px]"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <h3 className="text-lg font-bold uppercase tracking-tight text-white mb-2">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-text-muted">
        {text}
      </p>
    </div>
  );
}

// Step Card with custom number styling
function StepCard({ number, title, text, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center p-6 text-center transition-all duration-700 ease-out transform ${
        isVisible
          ? "opacity-100 translate-y-0 filter blur-0"
          : "opacity-0 translate-y-12 filter blur-[2px]"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="text-6xl font-black text-accent/15 tracking-tighter mb-3 block leading-none select-none font-mono">
        {number}
      </span>
      <h3 className="text-lg font-bold uppercase tracking-tight text-white mb-2">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-text-muted">
        {text}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const scrollToNext = () => {
    const socialSection = document.getElementById("stats-section");
    if (socialSection) {
      socialSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-sans">
      {/* Global CSS Inject for letter fade animation and glows */}
      <style jsx="true" global="true">{`
        @keyframes letter-fade {
          0% {
            opacity: 0;
            filter: blur(8px);
            transform: translateY(20px) scale(0.95);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0) scale(1);
          }
        }
        .animate-letter {
          animation: letter-fade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes pulse-glow-radial {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.25;
          }
          50% {
            transform: translate(-50%, -45%) scale(1.15);
            opacity: 0.45;
          }
        }
        .animate-glow-blob {
          animation: pulse-glow-radial 10s ease-in-out infinite;
        }
      `}</style>

      {/* SECTION 1 – HERO */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-16 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full bg-accent/8 blur-[130px] animate-glow-blob" />
          <div className="absolute -top-[10%] -left-[10%] w-[400px] h-[400px] rounded-full bg-accent/4 blur-[100px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[450px] h-[450px] rounded-full bg-accent/4 blur-[110px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto text-center mt-6">
          {/* Animated Hero Heading */}
          <AnimatedLetters />

          {/* Subtext */}
          <p className="mt-8 text-base sm:text-lg md:text-xl text-text-muted font-medium max-w-2xl px-4 animate-fade-up-delay-1">
            Wissenschaftlich fundiert. Kostenlos. Für die PerformanceProtokoll Community.
          </p>

          {/* Main CTA Button */}
          <div className="mt-10 animate-fade-up-delay-2">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-md bg-accent px-8 py-4 text-base font-bold uppercase tracking-wider text-white transition-all duration-300 hover:bg-accent-hover hover:scale-[1.03] active:scale-[0.98] hover:shadow-[0_0_35px_rgba(230,50,40,0.6)]"
            >
              Jetzt kostenlos starten
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <button
          onClick={scrollToNext}
          aria-label="Weiter nach unten scrollen"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-text-muted transition-colors hover:text-white group focus:outline-none"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 group-hover:opacity-100">
            Mehr erfahren
          </span>
          <ChevronDown className="h-6 w-6 animate-bounce text-accent" strokeWidth={2.5} />
        </button>
      </section>

      {/* SECTION 2 – SOCIAL PROOF */}
      <section
        id="stats-section"
        className="relative py-24 border-t border-border/40 bg-surface/10 px-4 scroll-mt-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-accent mb-12">
            Bereits von der PerformanceProtokoll Community genutzt
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <StatCard
              value={100}
              suffix="%"
              label="Kostenlos"
              icon={Flame}
              delay={0}
            />
            <StatCard
              value={24}
              suffix="/7"
              label="KI-Coach"
              icon={Cpu}
              delay={150}
            />
            <StatCard
              value={100}
              suffix="%"
              label="Wissenschaftlich fundiert"
              icon={Activity}
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* SECTION 3 – FEATURES */}
      <section className="relative py-24 border-t border-border/40 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
              Dein Laufpartner auf einem neuen Level
            </h2>
            <p className="mt-3 text-base text-text-muted max-w-xl mx-auto">
              Nutze modernste KI, um dein Lauftraining präzise, flexibel und datenbasiert zu steuern.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
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
              delay={150}
            />
            <FeatureCard
              icon={Cloud}
              title="Training bei jedem Wetter."
              text="PaceMind kennt das Wetter an deinem Standort und plant deine Einheiten entsprechend."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* SECTION 4 – HOW IT WORKS */}
      <section className="relative py-24 border-t border-border/40 bg-surface/10 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
              So funktioniert es
            </h2>
            <p className="mt-3 text-base text-text-muted max-w-xl mx-auto">
              In drei Schritten zu deiner neuen Bestzeit.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <StepCard
              number="01"
              title="Profil erstellen"
              text="Gib dein Ziel, Level und Trainingszeiten ein."
              delay={0}
            />
            <StepCard
              number="02"
              title="Plan erhalten"
              text="Der Coach erstellt deinen persönlichen Plan."
              delay={150}
            />
            <StepCard
              number="03"
              title="Trainieren & wachsen"
              text="Tracke deine Läufe, der Coach passt sich an."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* SECTION 5 – CTA */}
      <section className="relative py-24 border-t border-border/40 px-4 pb-32">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-2xl border border-accent/25 bg-surface-elevated/40 p-8 md:p-16 text-center overflow-hidden shadow-2xl backdrop-blur-md">
            {/* CTA Glow */}
            <div className="absolute -top-[50%] left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full bg-accent/10 blur-[80px] pointer-events-none select-none" />

            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                Bereit zu laufen?
              </h2>
              <p className="mt-4 text-base sm:text-lg text-text-muted font-medium">
                Kostenlos. Kein App Store. Direkt im Browser.
              </p>

              <div className="mt-8">
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2 rounded-md bg-accent px-8 py-4 text-base font-bold uppercase tracking-wider text-white transition-all duration-300 hover:bg-accent-hover hover:scale-[1.03] active:scale-[0.98] hover:shadow-[0_0_35px_rgba(230,50,40,0.6)]"
                >
                  Jetzt starten – kostenlos
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
                </Link>
              </div>

              {/* Impressum & Datenschutz */}
              <div className="mt-12 flex items-center justify-center gap-6 text-xs font-semibold uppercase tracking-wider text-text-muted">
                <Link
                  href="/impressum"
                  className="transition-colors hover:text-accent"
                >
                  Impressum
                </Link>
                <span className="h-3 w-px bg-border" />
                <Link
                  href="/datenschutz"
                  className="transition-colors hover:text-accent"
                >
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
