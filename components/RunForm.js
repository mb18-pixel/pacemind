"use client";

import { useState } from "react";
import { Footprints, Heart, Gauge } from "lucide-react";

export default function RunForm({ onSaved }) {
  const [distanceKm, setDistanceKm] = useState("");
  const [paceMin, setPaceMin] = useState("");
  const [paceSec, setPaceSec] = useState("");
  const [heartRateAvg, setHeartRateAvg] = useState("");
  const [heartRateMax, setHeartRateMax] = useState("");
  const [feeling, setFeeling] = useState("3");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distanceKm,
          paceMin,
          paceSec,
          heartRateAvg,
          heartRateMax,
          feeling,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");

      onSaved?.();
      setDistanceKm("");
      setPaceMin("");
      setPaceSec("");
      setHeartRateAvg("");
      setHeartRateMax("");
      setFeeling("3");
      setNotes("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-elevated animate-fade-up-delay-1 space-y-6 border-t-2 border-t-accent p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
          <Footprints size={20} className="text-accent" strokeWidth={2.5} />
        </div>
        <h2 className="text-lg font-extrabold uppercase tracking-tight text-text">
          Lauf eintragen
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
            <Footprints size={14} className="text-accent" />
            Distanz (km)
          </span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            required
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            className="input-field"
            placeholder="8.5"
          />
        </label>

        <div>
          <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
            <Gauge size={14} className="text-accent" />
            Pace (min/km)
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              max="59"
              required
              value={paceMin}
              onChange={(e) => setPaceMin(e.target.value)}
              className="input-field"
              placeholder="Min"
            />
            <span className="self-center font-bold text-text-muted">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={paceSec}
              onChange={(e) => setPaceSec(e.target.value)}
              className="input-field"
              placeholder="Sek"
            />
          </div>
        </div>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
            <Heart size={14} className="fill-accent text-accent" />
            Ø Herzfrequenz (bpm)
          </span>
          <input
            type="number"
            min="40"
            max="220"
            value={heartRateAvg}
            onChange={(e) => setHeartRateAvg(e.target.value)}
            className="input-field"
            placeholder="optional"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
            <Heart size={14} className="text-accent" />
            Max. Herzfrequenz (bpm)
          </span>
          <input
            type="number"
            min="40"
            max="220"
            value={heartRateMax}
            onChange={(e) => setHeartRateMax(e.target.value)}
            className="input-field"
            placeholder="optional"
          />
        </label>
      </div>

      <div>
        <span className="mb-3 block text-xs font-bold uppercase tracking-wide text-text-muted">
          Befinden (1–5)
        </span>
        <p className="mb-3 text-xs text-text-muted">
          1 = sehr schlecht, 5 = sehr gut
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFeeling(String(n))}
              className={`flex h-11 w-11 items-center justify-center rounded-md text-sm font-extrabold transition-all duration-200 ${
                feeling === String(n)
                  ? "bg-accent text-white shadow-[0_0_16px_rgba(230,50,40,0.4)]"
                  : "border border-border bg-surface text-text-muted hover:border-accent/50 hover:text-text"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
          Notizen (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="input-field resize-none"
          placeholder="Windig, leichte Kniebeschwerden …"
        />
      </label>

      {error && (
        <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full sm:w-auto"
      >
        {loading ? "Speichern …" : "Lauf speichern"}
      </button>

      {success && (
        <p className="text-sm font-semibold text-accent">
          Lauf gespeichert – der Coach nutzt ihn im Chat.
        </p>
      )}
    </form>
  );
}
