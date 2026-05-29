"use client";

import { useEffect, useState } from "react";

function formatKm(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return `${Math.round(v * 10) / 10} km`;
}

export default function OfflinePage() {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/training-plan?days=7");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Plan nicht verfügbar");
        if (cancelled) return;
        setPlan(data.plan || []);
        try {
          localStorage.setItem("offlineLastPlan", JSON.stringify(data.plan || []));
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
        try {
          const cached = JSON.parse(localStorage.getItem("offlineLastPlan") || "null");
          if (cached) setPlan(cached);
        } catch {
          /* ignore */
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-md border border-border bg-surface p-6">
      <div>
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
          Keine Verbindung
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Dein letzter Trainingsplan ist noch verfügbar (wenn du ihn vorher online geladen hast).
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Erneut versuchen
      </button>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text">Gecachter Wochenplan</h2>
        {plan && plan.length > 0 ? (
          <ul className="space-y-2">
            {plan.map((e) => (
              <li
                key={e.id || `${e.datum}-${e.trainingstyp}`}
                className="rounded-md border border-border bg-surface-elevated p-3 text-sm text-text"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{e.datum}</span>
                  <span className="text-text-muted">
                    {e.trainingstyp}
                    {e.distanz_km ? ` · ${formatKm(e.distanz_km)}` : ""}
                    {e.dauer_minuten ? ` · ${e.dauer_minuten} min` : ""}
                  </span>
                </div>
                {e.beschreibung ? (
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-text-muted">
                    {e.beschreibung}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">
            {error
              ? `Kein Plan im Cache (${error}).`
              : "Noch kein Plan im Cache."}
          </p>
        )}
      </div>
    </div>
  );
}

