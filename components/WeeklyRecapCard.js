"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Flame, Footprints, Clock, Sparkles } from "lucide-react";

export default function WeeklyRecapCard() {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    async function fetchLatestRecap() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Den neuesten wöchentlichen Recap abrufen
        const { data, error } = await supabase
          .from("weekly_recaps")
          .select("*")
          .order("woche_start", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // Prüfen, ob dieser spezielle Recap bereits geschlossen wurde
          const dismissedId = localStorage.getItem(`weekly_recap_dismissed_${data.id}`);
          if (dismissedId !== "1") {
            setRecap(data);
            setDismissed(false);
          }
        }
      } catch (e) {
        console.error("Fehler beim Laden des Wochen-Recaps:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchLatestRecap();
  }, []);

  const handleDismiss = () => {
    if (recap) {
      localStorage.setItem(`weekly_recap_dismissed_${recap.id}`, "1");
      setDismissed(true);
    }
  };

  if (loading || dismissed || !recap) return null;

  const gelaufeneKm = Number(recap.gelaufene_km) || 0;
  const geplanteKm = Number(recap.geplante_km) || 0;
  const percent = geplanteKm > 0 ? Math.min(Math.round((gelaufeneKm / geplanteKm) * 100), 100) : (gelaufeneKm > 0 ? 100 : 0);

  return (
    <div className="animate-fade-up rounded-xl border border-accent/20 bg-surface-elevated/30 p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background radial glow */}
      <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-accent/5 blur-3xl pointer-events-none select-none" />
      
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <span className="inline-block rounded-md bg-accent/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-accent mb-2">
              Wochen-Recap
            </span>
            <h2 className="text-xl font-black uppercase tracking-tight text-white md:text-2xl">
              Deine Woche im Überblick
            </h2>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-accent font-bold text-xs">
            <Flame className="h-4 w-4 animate-pulse" />
            <span>{recap.streak_wochen} {recap.streak_wochen === 1 ? "Woche" : "Wochen"} Streak</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <div className="flex items-center gap-3 rounded-lg bg-surface/50 p-4 border border-border/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Footprints size={18} strokeWidth={2.5} />
            </div>
            <div>
              <span className="block text-xl font-extrabold text-white">{recap.anzahl_läufe}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Läufe absolviert</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-surface/50 p-4 border border-border/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Clock size={18} strokeWidth={2.5} />
            </div>
            <div>
              <span className="block text-xl font-extrabold text-white">
                {recap.durchschnittspace} <span className="text-xs text-text-muted">min/km</span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Schnitt-Pace</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-surface/50 p-4 border border-border/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Flame size={18} strokeWidth={2.5} className="text-accent animate-pulse" />
            </div>
            <div>
              <span className="block text-xl font-extrabold text-white">{recap.streak_wochen}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Streak-Wochen</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="rounded-lg bg-surface/30 p-4 border border-border/20 mb-6">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2">
            <span className="text-text-muted">Fortschritt Distanz</span>
            <span className="text-white">
              {gelaufeneKm.toFixed(1)} km <span className="text-text-muted">von {geplanteKm.toFixed(1)} km</span> ({percent}%)
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-surface-elevated overflow-hidden border border-border/10">
            <div 
              className="h-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Coach Kommentar (Speech Bubble / Trainer Card style) */}
        {recap.coach_kommentar && (
          <div className="rounded-lg border-l-4 border-accent bg-accent/5 p-4 mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={14} className="text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider text-accent">Laufcoach / Personal Trainer</span>
            </div>
            <p className="text-sm italic leading-relaxed text-text">
              „{recap.coach_kommentar}“
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={handleDismiss}
            className="touch-target w-full sm:w-auto rounded-md bg-accent px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all duration-200 hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(230,50,40,0.4)] cursor-pointer"
          >
            Nächste Woche →
          </button>
        </div>
      </div>
    </div>
  );
}
