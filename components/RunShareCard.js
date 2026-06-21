"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { formatPace } from "@/lib/runs";

const QUOTES = {
  langsam: [],
  mittel: [],
  schnell: [],
  lang: [],
  kurz: [],
  gut: [],
  schlecht: [],
  bestzeit: [
    "Neue Bestzeit. Endlich etwas in deinem Leben, das vorankommt.",
    "PR erreicht. Deine Eltern sind jetzt vielleicht endlich etwas stolz.",
    "Du warst heute schneller als die meisten deiner Ausreden.",
    "Neue Bestzeit. Endlich etwas, bei dem du nicht enttäuschst.",
    "Neue Bestzeit. Die Messlatte lag offenbar tief genug.",
    "Noch ein Rekord. Jetzt fehlen nur noch die anderen Erfolge.",
  ],
  allgemein: [
    "Du warst heute länger unterwegs als die meisten Beziehungen halten.",
    "Du hältst dein Lauftempo länger als manche ihre Ehe.",
    "So viel Einsatz. Für so einen Lauf?",
    "Deine Pace war konstant. Das kann nicht jeder von seinem Liebesleben behaupten.",
    "Kalorien verbrannt. Deine Chancen auf ein Date bleiben trotzdem bei 0.",
    "Starke Leistung. Juckt aber wirklich keinen.",
    "Mehr leere Versprechen gab es heute nur im Wahlkampf.",
    "Deine Beine sind angeschlagener als der Staatshaushalt.",
    "Deine Motivation hält länger als manche Koalition.",
    "Der Puls steigt schneller als öffentliche Ausgaben.",
    "Das Tempo erinnert an deutsche Behörden.",
    "Mehr rote Flaggen gab es heute nur in deinem Dating-Profil.",
    "Wenn schlechte Entscheidungen Sport wären, wärst du Weltmeister.",
    "Ascend sieht Fortschritt bei dir. Der Rest deines Lebens eher nicht.",
    "Starke Einheit. Schade, dass man Charakter nicht trainieren kann.",
    "Du rennst mit beeindruckender Konsequenz in die falsche Richtung.",
    "Beeindruckende Leistung für Menschen wie dich!",
    "Selbst ich als KI mache mir Sorgen bei dir…",
    "Du bist beim Laufen sogar schneller als im Bett am Ziel!",
    "Auf wen hast du beim Laufen gewartet?",
    "Beeindruckende Leistung. Fast genug, um von allem anderen abzulenken.",
    "Ascend hat einen Fortschritt erkannt. Wir waren selbst überrascht.",
    "Du bist heute weiter gekommen als deine letzte Beziehung.",
    "Deine Ausdauer ist beeindruckend. Schade, dass niemand da ist, den das interessiert.",
    "Du bist heute weiter gekommen als deine Karriere.",
    "Die App ist stolz auf dich. Sonst meldet sich ja niemand.",
  ],
};

function paceSecPerKm(run) {
  return run.paceMin * 60 + (run.paceSec || 0);
}

function isBestzeit(run, allRuns) {
  const currentDist = Number(run.distanceKm) || 0;
  const currentPaceSec = paceSecPerKm(run);
  
  // Find comparable runs (±15% distance tolerance)
  const comparableRuns = allRuns.filter(r => {
    const dist = Number(r.distanceKm) || 0;
    const tolerance = currentDist * 0.15;
    return dist >= currentDist - tolerance && dist <= currentDist + tolerance;
  });
  
  // If no comparable runs, it's not a PR (no reference times in DB)
  if (comparableRuns.length === 0) return false;
  
  // Check if current pace is faster than all comparable runs
  const isFastest = comparableRuns.every(r => {
    const paceSec = paceSecPerKm(r);
    return currentPaceSec < paceSec;
  });
  
  return isFastest;
}

export function pickHumorQuote(run, isBestzeit = false) {
  let pool;
  
  // 70% chance to use bestzeit quotes if it's a PR
  if (isBestzeit && Math.random() < 0.7) {
    pool = [...QUOTES.bestzeit];
  } else {
    pool = [...QUOTES.allgemein];
  }
  
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
        height: 1920,
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32, textAlign: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 28, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Distanz
            </p>
            <p style={{ margin: "16px 0 0", fontSize: 96, fontWeight: 900, lineHeight: 1 }}>
              {run.distanceKm}
              <span style={{ fontSize: 42, color: "#888", marginLeft: 10 }}>km</span>
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 28, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Pace
            </p>
            <p style={{ margin: "16px 0 0", fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {formatPace(run.paceMin, run.paceSec)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 28, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Dauer
            </p>
            <p style={{ margin: "16px 0 0", fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {formatDuration(run)}
            </p>
          </div>
        </div>

        {hfLine && (
          <p style={{ margin: 0, textAlign: "center", fontSize: 36, color: "#e63228", fontWeight: 700 }}>
            {hfLine}
          </p>
        )}

        <p style={{ margin: 0, textAlign: "center", fontSize: 28, color: "#666" }}>
          {formatCardDate(run.date)}
        </p>

        <p
          style={{
            margin: "24px 0 0",
            textAlign: "center",
            fontSize: 36,
            lineHeight: 1.5,
            color: "#ccc",
            fontStyle: "italic",
            padding: "0 32px",
          }}
        >
          "{quote}"
        </p>
      </div>

      <p style={{ margin: 0, textAlign: "center", fontSize: 26, color: "#555", letterSpacing: "0.05em" }}>
        ascend-training-ai.vercel.app
      </p>
    </div>
  );
}

export function ShareRunButton({ run }) {
  const cardRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [capture, setCapture] = useState(null);

  async function handleShare() {
    // Fetch all runs to check for PR
    let allRuns = [run];
    try {
      const response = await fetch("/api/runs");
      if (response.ok) {
        const data = await response.json();
        allRuns = data.runs || [];
      }
    } catch (err) {
      console.error("Failed to fetch runs for PR check:", err);
    }

    const isBestzeitFlag = isBestzeit(run, allRuns);
    const quote = pickHumorQuote(run, isBestzeitFlag);
    setCapture({ run, quote });
    setStatus("generating");

    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    try {
      if (!cardRef.current) throw new Error("Share-Karte nicht bereit");

      const dataUrl = await toPng(cardRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        cacheBust: true,
      });

      const datum = new Date(run.date).toISOString().split("T")[0];
      
      // Convert dataUrl to Blob, then to File
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `ascend-lauf-${datum}.png`, { type: "image/png" });
      
      // Try Web Share API with file support
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Mein Lauf",
            text: `Mein Lauf vom ${formatCardDate(run.date)}: ${run.distanceKm}km in ${formatPace(run.paceMin, run.paceSec)}/km`,
          });
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 3000);
        } catch (shareErr) {
          // AbortError means user cancelled - normal behavior, no error message
          if (shareErr.name !== "AbortError") {
            console.error("Share API Fehler:", shareErr);
          }
          setStatus("idle");
        }
      } else {
        // Fallback: classic download for browsers without Share API
        const link = document.createElement("a");
        link.download = `ascend-lauf-${datum}.png`;
        link.href = dataUrl;
        link.click();
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      }
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
