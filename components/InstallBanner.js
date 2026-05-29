"use client";

import { useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "installBannerDismissedUntil";
const INSTALLED_KEY = "installBannerInstalled";

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS: navigator.standalone; andere: display-mode
  return (
    window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );
}

export default function InstallBanner() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const ios = useMemo(() => isIos(), []);
  const [dismissedUntil, setDismissedUntil] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(DISMISS_KEY) || 0);
  });
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Wenn bereits installiert: nicht zeigen
    if (installed) return;

    // 7 Tage nach "Später" ausblenden
    if (dismissedUntil && Date.now() < dismissedUntil) return;

    // „Nach dem Login“: leichtgewichtig prüfen (401 => nicht eingeloggt)
    fetch("/api/training-plan?days=1")
      .then((res) => {
        if (res.ok) setIsAuthed(true);
      })
      .catch(() => {
        /* ignore */
      });
  }, [dismissedUntil, installed]);

  useEffect(() => {
    // Ablauf der 7-Tage-Sperre bereinigen (ohne Date.now() im Render)
    if (typeof window === "undefined") return;
    if (!dismissedUntil) return;
    if (Date.now() < dismissedUntil) return;
    localStorage.removeItem(DISMISS_KEY);
    Promise.resolve().then(() => setDismissedUntil(0));
  }, [dismissedUntil]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e) => {
      // Android/Chrome: beforeinstallprompt
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setInstalled(true);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  function dismiss(days = 7) {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissedUntil(until);
  }

  async function installNow() {
    if (!deferredPrompt) {
      // iOS / Safari
      dismiss(7);
      return;
    }
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice?.outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1");
        setInstalled(true);
      } else {
        dismiss(7);
      }
    } catch {
      dismiss(7);
    }
  }

  const shouldShow =
    isAuthed &&
    !installed &&
    dismissedUntil === 0 &&
    !isStandalone();

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-full max-w-5xl px-4">
      <div className="rounded-lg border border-border bg-surface-elevated p-4 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-text">
              Installiere PaceMind auf deinem Homescreen
            </p>
            <p className="text-sm text-text-muted">
              Schnellerer Zugriff + Push-Benachrichtigungen
            </p>
            {ios && (
              <p className="mt-2 text-xs text-text-muted">
                iOS: Tippe auf <span className="font-semibold">Teilen</span> →{" "}
                <span className="font-semibold">Zum Home-Bildschirm</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => dismiss(7)}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text-muted hover:bg-surface-elevated"
            >
              Später
            </button>
            <button
              onClick={installNow}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Jetzt installieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
