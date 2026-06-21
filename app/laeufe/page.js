"use client";

import { useCallback, useEffect, useState } from "react";
import { Footprints } from "lucide-react";
import RunForm from "@/components/RunForm";
import RunHistory from "@/components/RunHistory";
import { createClient } from "@/lib/supabase/client";

export default function LaeufePage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [modalChecked, setModalChecked] = useState(false);

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

  useEffect(() => {
    async function checkHintStatus() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setModalChecked(true);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("laeufe_hinweis_gesehen")
        .eq("id", user.id)
        .single();

      if (profile && !profile.laeufe_hinweis_gesehen) {
        setShowWelcomeModal(true);
      }
      setModalChecked(true);
    }

    checkHintStatus();
  }, []);

  async function handleDismissModal() {
    // Modal sofort schließen, UI nicht auf Netzwerk warten lassen
    setShowWelcomeModal(false);
    // Fokus sauber zurücksetzen, um Touch-Event-Probleme zu vermeiden
    document.activeElement?.blur();
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ laeufe_hinweis_gesehen: true })
        .eq("id", user.id);
    }
  }

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

      {showWelcomeModal && (
        <div className="modal-overlay" style={{ zIndex: 50 }}>
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />
            <div className="px-4 pb-6">
              <h2 className="mb-4 text-lg font-extrabold uppercase tracking-tight text-text">
                Kurz und ehrlich, bevor du loslegst:
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-text-muted">
                Wir bauen Ascend gerade noch zusammen. Diese Seite hier zeigt deine Läufe – im Moment noch von Hand eingetragen, weil wir die Garmin- und Strava-Integration erst noch fertigstellen. Versprochen: Die kommt.
                Bis dahin freuen wir uns über jeden Lauf, den du hier festhältst – und über jedes Feedback, das du uns gibst. Du hilfst uns damit, Ascend genau für Läufer wie dich zu bauen.
              </p>
              <button
                type="button"
                onClick={handleDismissModal}
                className="btn-primary w-full"
              >
                Verstanden, los geht's
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
