"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChatTutorialOverlay from "@/components/ChatTutorialOverlay";
import MobileTutorialOverlay from "@/components/MobileTutorialOverlay";

const STEPS = [
  {
    key: "chat",
    target: '[data-tutorial="chat-input"]',
    text: `Hier sprichst du mit deinem Coach.\nFrag ihn alles – er kennt deinen Plan,\ndeine Läufe und das Wetter.`,
    chips: [
      "Wie ist mein Plan?",
      "Ich bin müde",
      "Verlege Mittwoch"
    ]
  },
  {
    key: "laeufe",
    target: '[data-tutorial="nav-laeufe"]',
    text: `Nach jedem Training hier eintragen –\noder einfach dem Coach sagen:\n'Ich bin heute 8km in 5:30 gelaufen'`,
  },
  {
    key: "zeiten",
    target: '[data-tutorial="trainingszeiten"]',
    text: `Hier siehst und änderst du wann du trainierst.\nDer Plan passt sich automatisch an.`,
  },
  {
    key: "fertig",
    target: null,
    text: `Du bist bereit. Dein Coach wartet.`,
    isFinal: true,
  },
];

const MOBILE_STEPS = [
  {
    key: "chat",
    emoji: "🧠",
    title: "Dein Coach",
    text: "Hier ist dein persönlicher Laufcoach. Stell ihm alles – er kennt deinen Plan, deine Läufe und passt sich dir an.",
  },
  {
    key: "laeufe",
    emoji: "🏃",
    title: "Läufe eintragen",
    text: "Hier trägst du deine Trainings ein – oder sag es einfach dem Coach: 'Ich bin heute 8km gelaufen'",
  },
  {
    key: "kalender",
    emoji: "📅",
    title: "Dein Trainingsplan",
    text: "Hier siehst du deinen Trainingsplan. Tippe auf ein Training für alle Details.",
  },
  {
    key: "mehr",
    emoji: "⚙️",
    title: "Mehr & Einstellungen",
    text: "Unter 'Mehr' findest du Feedback, Impressum und alles Weitere.",
    isFinal: true,
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const steps = useMemo(() => (isMobile ? MOBILE_STEPS : STEPS), [isMobile]);

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
    if (isMobile) {
      setStepIndex((i) => Math.min(i + 1, MOBILE_STEPS.length - 1));
    } else {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }
  }, [isMobile]);

  const onLater = useCallback(() => {
    finish();
  }, [finish]);

  if (!checked) return null;

  if (isMobile) {
    return (
      <MobileTutorialOverlay
        open={open}
        stepIndex={stepIndex}
        steps={steps}
        onNext={onNext}
        onLater={onLater}
      />
    );
  } else {
    return (
      <ChatTutorialOverlay
        open={open}
        stepIndex={stepIndex}
        steps={steps}
        onSkip={onSkip}
        onNext={onNext}
        onLater={onLater}
      />
    );
  }
}

