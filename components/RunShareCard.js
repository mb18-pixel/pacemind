"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { formatPace } from "@/lib/runs";

const QUOTES = {
  langsam: [
    "Geschwindigkeit ist relativ. Genau wie meine Lebenserwartung beim nächsten Mal.",
    "Ich war nicht schnell. Aber ich war da. Das zählt auch, oder?",
    "Mein Tempo heute: gemütlicher Spaziergang mit Ambitionen.",
  ],
  mittel: [
    "Nicht schnell, nicht langsam. Einfach... anwesend.",
    "Heute kein Rekord. Aber auch kein Krankenwagen nötig.",
  ],
  schnell: [
    "Mein Hausarzt wäre stolz. Mein Hausarzt wäre besorgt.",
    "Lief schneller als meine Lebensentscheidungen normalerweise gehen.",
  ],
  lang: [
    "Mein Körper hat mehrfach um eine Auszeit gebeten. Ich habe ignoriert.",
    "Heute mehr Kilometer gelaufen als ich Probleme gelöst habe.",
  ],
  kurz: [
    "Kurz, aber immerhin nicht Couch.",
    "Klein aber oho. Hauptsache raus.",
  ],
  gut: [
    "Endorphine: 1, Innere Stimme die sagte 'bleib im Bett': 0",
  ],
  schlecht: [
    "Manche Tage läuft man einfach. Andere Tage überlebt man.",
  ],
  allgemein: [
    "Lief heute. Niemand hat mich gezwungen. Ich verstehe es selbst nicht.",
    "Schritt für Schritt näher am Marathon. Oder am Orthopäden.",
    "Heute kein Rekord gebrochen. Nur mein Wille zur Vernunft.",
    "Liefen Menschen schon vor Netflix. Verrückte Zeiten.",
    "Mein Knie hat heute eine eigene Meinung gehabt.",
  ],
};

function paceSecPerKm(run) {
  return run.paceMin * 60 + (run.paceSec || 0);
}

export function pickHumorQuote(run) {
  const pool = [...QUOTES.allgemein];
  const paceSec = paceSecPerKm(run);
  const dist = Number(run.distanceKm) || 0;
  const feeling = Number(run.feeling) || 0;

  if (paceSec > 390) pool.push(...QUOTES.langsam);
  else if (paceSec >= 300) pool.push(...QUOTES.mittel);
  else pool.push(...QUOTES.schnell);

  if (dist > 15) pool.push(...QUOTES.lang);
  if (dist < 5) pool.push(...QUOTES.kurz);
  if (feeling >= 5) pool.push(...QUOTES.gut);
  if (feeling <= 2 && feeling > 0) pool.push(...QUOTES.schlecht);

  return pool[Math.floor(Math.random() * pool.length)];
}

function formatDuration(run) {
  const totalSec = paceSecPerKm(run) * (Number(run.distanceKm) || 0);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCardDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ShareCardContent({ run, quote }) {
  const hfLine = run.heartRateAvg
    ? `Ø ${run.heartRateAvg} bpm${run.heartRateMax ? ` · max ${run.heartRateMax}` : ""}`
    : null;

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        background: "#0a0a0a",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 64px",
        boxSizing: "border-box",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "0.2em",
            color: "#e63228",
            textTransform: "uppercase",
          }}
        >
          Ascend
        </p>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 16,
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}
        >
          by PerformanceProtokoll
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, textAlign: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 22, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Distanz
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {run.distanceKm}
              <span style={{ fontSize: 32, color: "#888", marginLeft: 8 }}>km</span>
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 22, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Pace
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 56, fontWeight: 900, lineHeight: 1 }}>
              {formatPace(run.paceMin, run.paceSec)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 22, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Dauer
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 56, fontWeight: 900, lineHeight: 1 }}>
              {formatDuration(run)}
            </p>
          </div>
        </div>

        {hfLine && (
          <p style={{ margin: 0, textAlign: "center", fontSize: 28, color: "#e63228", fontWeight: 700 }}>
            {hfLine}
          </p>
        )}

        <p style={{ margin: 0, textAlign: "center", fontSize: 24, color: "#666" }}>
          {formatCardDate(run.date)}
        </p>

        <p
          style={{
            margin: "16px 0 0",
            textAlign: "center",
            fontSize: 30,
            lineHeight: 1.5,
            color: "#ccc",
            fontStyle: "italic",
            padding: "0 24px",
          }}
        >
          „{quote}"
        </p>
      </div>

      <p style={{ margin: 0, textAlign: "center", fontSize: 20, color: "#444", letterSpacing: "0.05em" }}>
        ascend.vercel.app
      </p>
    </div>
  );
}

export function ShareRunButton({ run }) {
  const cardRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [capture, setCapture] = useState(null);

  async function handleShare() {
    const quote = pickHumorQuote(run);
    setCapture({ run, quote });
    setStatus("generating");

    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    try {
      if (!cardRef.current) throw new Error("Share-Karte nicht bereit");

      const dataUrl = await toPng(cardRef.current, {
        width: 1080,
        height: 1080,
        pixelRatio: 1,
        cacheBust: true,
      });

      const datum = new Date(run.date).toISOString().split("T")[0];
      const link = document.createElement("a");
      link.download = `ascend-lauf-${datum}.png`;
      link.href = dataUrl;
      link.click();

      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error("Share-Karte Fehler:", err);
      setStatus("idle");
    } finally {
      setCapture(null);
    }
  }

  const label =
    status === "generating"
      ? "Wird erstellt…"
      : status === "saved"
        ? "Bild gespeichert! Bereit für Reddit 😏"
        : "📸 Als Bild teilen";

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={status === "generating"}
        className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 self-start rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-50 sm:self-center"
      >
        {label}
      </button>

      {capture && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: -9999,
            top: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <div ref={cardRef}>
            <ShareCardContent run={capture.run} quote={capture.quote} />
          </div>
        </div>
      )}
    </>
  );
}
