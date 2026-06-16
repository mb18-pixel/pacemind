"use client";

import { formatPace } from "@/lib/runs";
import { Footprints, Heart, Trash2 } from "lucide-react";
import { ShareRunButton } from "@/components/RunShareCard";

export default function RunHistory({ runs, onDelete }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-10 text-center">
        <Footprints size={32} className="mx-auto text-text-muted" strokeWidth={1.5} />
        <p className="mt-4 text-sm text-text-muted">
          Noch keine Läufe eingetragen. Trage deinen ersten Lauf ein – der Coach
          nutzt sie als Kontext im Chat.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {runs.map((run) => {
        const date = new Date(run.date).toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        return (
          <li
            key={run.id}
            className="run-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-accent">
                {date}
              </p>
              <p className="font-extrabold uppercase tracking-tight text-text">
                {run.distanceKm} km
              </p>
              <p className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                <span>{formatPace(run.paceMin, run.paceSec)}</span>
                {run.heartRateAvg && (
                  <span className="flex items-center gap-1">
                    <Heart size={14} className="fill-accent text-accent" />
                    Ø {run.heartRateAvg}
                  </span>
                )}
                {run.heartRateMax && (
                  <span className="flex items-center gap-1">
                    <Heart size={14} className="text-accent" />
                    max {run.heartRateMax}
                  </span>
                )}
                <span>Befinden {run.feeling}/5</span>
              </p>
              {run.notes && (
                <p className="text-sm italic text-text-muted">{run.notes}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              <ShareRunButton run={run} />
              <button
                type="button"
                onClick={() => onDelete(run.id)}
                className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"
              >
                <Trash2 size={14} />
                Löschen
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
