"use client";

import { useCallback, useEffect, useState } from "react";
import { Footprints } from "lucide-react";
import RunForm from "@/components/RunForm";
import RunHistory from "@/components/RunHistory";

export default function LaeufePage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRuns(data.runs || []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(id) {
    const res = await fetch(`/api/runs/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
            <Footprints size={20} className="text-accent" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
              Deine Läufe
            </h1>
            <p className="text-sm text-text-muted">
              Die letzten 5 Läufe werden im Coach-Chat als Kontext genutzt.
            </p>
          </div>
        </div>
      </div>

      <RunForm onSaved={refresh} />

      <section className="animate-fade-up-delay-2">
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-text-muted">
          Verlauf
        </h2>
        {loading ? (
          <p className="text-sm text-text-muted">Läufe werden geladen …</p>
        ) : (
          <RunHistory runs={runs} onDelete={handleDelete} />
        )}
      </section>
    </div>
  );
}
