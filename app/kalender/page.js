"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import TrainingDetailModal from "@/components/TrainingDetailModal";

const TYPE_LABELS = {
  locker: "Locker",
  tempo: "Tempo",
  intervall: "Intervall",
  langlauf: "Langlauf",
  pause: "Pause",
  regeneration: "Regeneration",
};

const TYPE_COLORS = {
  locker: "border-blue-500/40 bg-blue-500/10",
  tempo: "border-orange-500/40 bg-orange-500/10",
  intervall: "border-red-500/40 bg-red-500/10",
  langlauf: "border-purple-500/40 bg-purple-500/10",
  pause: "border-border bg-surface-elevated/50",
  regeneration: "border-green-500/40 bg-green-500/10",
};

export default function KalenderPage() {
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/training-plan?days=14");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlan(data.plan || []);
    } catch {
      setPlan([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="page-container space-y-6">
      <div className="animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
            <Calendar size={20} className="text-accent" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="page-title">Trainingskalender</h1>
            <p className="page-subtitle">
              Dein Plan für die nächsten 14 Tage.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Plan wird geladen …</p>
      ) : plan.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface p-8 text-center text-sm text-text-muted">
          Noch kein Trainingsplan vorhanden. Frag deinen Coach im Chat.
        </div>
      ) : (
        <div className="calendar-scroll -mx-4 px-4">
          <div className="calendar-scroll-inner">
            {plan.map((entry) => {
              const d = new Date(entry.datum);
              const wochentag = d.toLocaleDateString("de-DE", { weekday: "short" });
              const tag = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
              const typ = entry.trainingstyp || "pause";
              const color = TYPE_COLORS[typ] || TYPE_COLORS.pause;
              const isToday =
                entry.datum === new Date().toISOString().split("T")[0];

              return (
                <button
                  key={entry.id || entry.datum}
                  type="button"
                  onClick={() => typ !== "pause" && setSelected(entry)}
                  className={`calendar-day-card card min-h-[120px] min-w-[140px] shrink-0 snap-start border p-4 text-left transition-all ${color} ${
                    isToday ? "ring-2 ring-accent" : ""
                  } ${typ === "pause" ? "opacity-70" : "hover:border-accent"}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    {wochentag}
                  </p>
                  <p className="mt-1 text-lg font-black text-text">{tag}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-text">
                    {TYPE_LABELS[typ] || typ}
                  </p>
                  {entry.distanz_km ? (
                    <p className="mt-1 text-sm text-text-muted">
                      {entry.distanz_km} km
                    </p>
                  ) : null}
                  {entry.dauer_minuten ? (
                    <p className="text-xs text-text-muted">
                      {entry.dauer_minuten} min
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <TrainingDetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        trainingEntry={selected}
        onComplete={() => setSelected(null)}
        onSkip={() => setSelected(null)}
        onLogRun={() => setSelected(null)}
      />
    </div>
  );
}
