"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChatTutorialOverlay from "@/components/ChatTutorialOverlay";

const STEPS = [
  {
    key: "chat",
    target: '[data-tutorial="chat-input"]',
    text: `Hier sprichst du mit deinem Coach.\nFrag ihn alles – er kennt deinen Plan,\ndeine Läufe und das Wetter.`,
  },
  {
    key: "kalender",
    target: '[data-tutorial="nav-kalender"]',
    text: `Hier siehst du deinen Trainingsplan.\nDer Coach passt ihn automatisch an\nwenn du ihm Bescheid gibst.`,
  },
  {
    key: "laeufe",
    target: '[data-tutorial="nav-laeufe"]',
    text: `Nach jedem Lauf trägst du hier\ndeine Daten ein – oder sagst es einfach\ndem Coach im Chat.`,
  },
  {
    key: "pwa",
    target: null,
    text: `Installiere PaceMind auf deinem\nHomescreen für schnellen Zugriff und\nTrainings-Erinnerungen.`,
  },
];

async function markTutorialDone() {
  const res = await fetch("/api/profile/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tutorial_abgeschlossen: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Tutorial-Status konnte nicht gespeichert werden");
  return true;
}

export default function ChatTutorialGate() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState(false);

  const steps = useMemo(() => STEPS, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) Promise.resolve().then(() => setChecked(true));
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("tutorial_abgeschlossen")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        Promise.resolve().then(() => {
          setChecked(true);
          if (!data?.tutorial_abgeschlossen) {
            setOpen(true);
            setStepIndex(0);
          }
        });
      } catch {
        if (!cancelled) Promise.resolve().then(() => setChecked(true));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(async () => {
    try {
      await markTutorialDone();
    } catch {
      // Wenn Speichern fehlschlägt, Tutorial trotzdem schließen, um nicht zu blockieren.
    } finally {
      setOpen(false);
    }
  }, []);

  const onSkip = useCallback(() => {
    finish();
  }, [finish]);

  const onNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const onInstall = useCallback(() => {
    // Navbar öffnet dann das bestehende Install/Push-Modal
    window.dispatchEvent(new CustomEvent("pacemind-open-install-modal"));
    finish();
  }, [finish]);

  const onLater = useCallback(() => {
    finish();
  }, [finish]);

  if (!checked) return null;

  return (
    <ChatTutorialOverlay
      open={open}
      stepIndex={stepIndex}
      steps={steps}
      onSkip={onSkip}
      onNext={onNext}
      onInstall={onInstall}
      onLater={onLater}
    />
  );
}

