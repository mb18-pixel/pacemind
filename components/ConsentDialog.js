"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Check } from "lucide-react";

export default function ConsentDialog() {
  const router = useRouter();
  const [privacy, setPrivacy] = useState(false);
  const [age, setAge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canContinue = privacy && age;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canContinue || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "Server hat keine JSON-Antwort geliefert. Bitte Seite neu laden."
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");

      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up mx-auto w-full max-w-lg">
      <div className="card-elevated border-t-2 border-t-accent p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
            <Shield size={20} className="text-accent" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-text">
              Willkommen
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              PerformanceProtokoll
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-text-muted">
          Bevor du startest, bestätige bitte die folgenden Punkte.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent/50">
            <input
              type="checkbox"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-sm border-border accent-accent"
            />
            <span className="text-sm text-text">
              Ich stimme der{" "}
              <Link
                href="/datenschutz"
                target="_blank"
                className="font-semibold text-accent underline hover:text-accent-hover"
              >
                Datenschutzerklärung
              </Link>{" "}
              zu.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent/50">
            <input
              type="checkbox"
              checked={age}
              onChange={(e) => setAge(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-sm border-border accent-accent"
            />
            <span className="text-sm text-text">
              Ich bin mindestens 18 Jahre alt.
            </span>
          </label>

          {error && (
            <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canContinue || loading}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <Check size={18} strokeWidth={2.5} />
            {loading ? "Speichern …" : "Weiter zum Coach"}
          </button>
        </form>
      </div>
    </div>
  );
}
