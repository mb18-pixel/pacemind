"use client";

import { useEffect, useMemo, useState } from "react";

const INSTALLED_KEY = "installBannerInstalled";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );
}

function getBrowserFlags() {
  if (typeof window === "undefined") {
    return { isIOS: false, isAndroid: false, isChrome: false, isSafari: false };
  }
  // Vorgabe aus Ticket
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua);
  const isSafari = /Safari/.test(ua) && !isChrome;
  return { isIOS, isAndroid, isChrome, isSafari };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function Step({ emoji, children }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-lg">{emoji}</span>
      <span className="text-sm text-text-muted">{children}</span>
    </li>
  );
}

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        checked
          ? "border-accent bg-accent"
          : "border-border bg-surface-elevated"
      } ${disabled ? "opacity-60" : "hover:opacity-95"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function InstallAppModal({
  open,
  onClose,
  deferredPrompt,
  onInstalled,
}) {
  const { isIOS, isAndroid, isChrome, isSafari } = useMemo(
    () => getBrowserFlags(),
    []
  );

  const [installStatus, setInstallStatus] = useState("idle"); // idle | prompting | done | error
  const [installMessage, setInstallMessage] = useState("");

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState("idle"); // idle | requesting | granted | disabling | error
  const [pushMessage, setPushMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    // eslint: avoid setState synchronously inside effects
    Promise.resolve().then(() => {
      setInstallMessage("");
      setInstallStatus("idle");
      setPushMessage("");
      setPushStatus("idle");
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    (async () => {
      try {
        if (Notification.permission !== "granted") {
          setPushEnabled(false);
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setPushEnabled(Boolean(sub));
      } catch {
        // ignore
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function triggerInstall() {
    setInstallMessage("");

    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, "1");
      onInstalled?.();
      setInstallStatus("done");
      return;
    }

    if (!deferredPrompt) {
      // iOS / Safari / kein beforeinstallprompt
      setInstallStatus("idle");
      return;
    }

    try {
      setInstallStatus("prompting");
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1");
        setInstallStatus("done");
        setInstallMessage("Installation gestartet ✓");
        onInstalled?.();
      } else {
        setInstallStatus("idle");
      }
    } catch (e) {
      setInstallStatus("error");
      setInstallMessage(e?.message || "Install-Dialog konnte nicht geöffnet werden");
    }
  }

  async function setPush(next) {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushMessage("Push wird von diesem Browser nicht unterstützt.");
      return;
    }

    setPushMessage("");

    if (next) {
      setPushStatus("requesting");
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setPushStatus("idle");
          setPushEnabled(false);
          return;
        }

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt");

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data?.error || "Subscription konnte nicht gespeichert werden"
          );

        setPushEnabled(true);
        setPushStatus("granted");
        setPushMessage("Erinnerungen aktiviert ✓");
      } catch (e) {
        setPushEnabled(false);
        setPushStatus("error");
        setPushMessage(e?.message || "Push konnte nicht aktiviert werden");
      }
      return;
    }

    // disable / unsubscribe
    setPushStatus("disabling");
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      const res = await fetch("/api/push/unsubscribe", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Push konnte nicht deaktiviert werden");

      setPushEnabled(false);
      setPushStatus("idle");
      setPushMessage("Erinnerungen deaktiviert.");
    } catch (e) {
      setPushStatus("error");
      setPushMessage(e?.message || "Push konnte nicht deaktiviert werden");
    }
  }

  if (!open) return null;

  const showAndroidChrome = isAndroid && isChrome;
  const showIosSafari = isIOS && isSafari;
  const showDesktopChrome = !isIOS && !isAndroid && isChrome;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Modal schließen"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl rounded-xl border border-border bg-bg shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-text">
              PaceMind auf dem Homescreen
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Installiere PaceMind als App für schnelleren Zugriff.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-muted hover:bg-surface-elevated"
          >
            Schließen
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {showIosSafari ? (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-text">
                iOS (Safari)
              </h3>
              <ol className="space-y-2">
                <Step emoji="📤">
                  Tippe auf das Teilen-Icon unten in Safari
                </Step>
                <Step emoji="📱">
                  Wähle <span className="font-semibold text-text">„Zum Home-Bildschirm“</span>
                </Step>
                <Step emoji="✅">
                  Tippe <span className="font-semibold text-text">„Hinzufügen“</span>
                </Step>
              </ol>

              <div className="rounded-lg border border-border bg-surface-elevated p-3">
                <p className="text-xs text-text-muted">
                  Tipp: Nach dem Hinzufügen öffnet sich PaceMind wie eine echte App (Vollbild).
                </p>
              </div>
            </section>
          ) : null}

          {showAndroidChrome ? (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-text">
                Android (Chrome)
              </h3>

              {deferredPrompt ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-text-muted">
                    Tippe auf „Jetzt installieren“, um den nativen Install-Dialog zu öffnen.
                  </p>
                  <button
                    type="button"
                    onClick={triggerInstall}
                    disabled={installStatus === "prompting"}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    Jetzt installieren
                  </button>
                </div>
              ) : (
                <ol className="space-y-2">
                  <Step emoji="⋮">Öffne das Chrome-Menü (drei Punkte)</Step>
                  <Step emoji="📲">
                    Wähle <span className="font-semibold text-text">„App installieren“</span>
                  </Step>
                </ol>
              )}

              {installMessage ? (
                <p
                  className={`text-sm ${
                    installStatus === "error" ? "text-accent" : "text-text-muted"
                  }`}
                >
                  {installMessage}
                </p>
              ) : null}
            </section>
          ) : null}

          {showDesktopChrome ? (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-text">
                Desktop (Chrome)
              </h3>
              <p className="text-sm text-text-muted">
                Klicke in der Adressleiste auf das Install-Icon (📦/➕), um PaceMind zu installieren.
              </p>
              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={triggerInstall}
                  disabled={installStatus === "prompting"}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  Jetzt installieren
                </button>
              ) : null}
              {installMessage ? (
                <p
                  className={`text-sm ${
                    installStatus === "error" ? "text-accent" : "text-text-muted"
                  }`}
                >
                  {installMessage}
                </p>
              ) : null}
            </section>
          ) : null}

          {!showIosSafari && !showAndroidChrome && !showDesktopChrome ? (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-text">
                Installation
              </h3>
              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={triggerInstall}
                  disabled={installStatus === "prompting"}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  Jetzt installieren
                </button>
              ) : (
                <p className="text-sm text-text-muted">
                  In diesem Browser ist keine direkte Installation verfügbar. Öffne PaceMind in Chrome/Safari.
                </p>
              )}
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-surface-elevated p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-text">
                  🔔 Trainings-Erinnerungen aktivieren
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Optional: Erinnerungen zu Trainings & Updates.
                </p>
                {pushMessage ? (
                  <p
                    className={`mt-2 text-sm ${
                      pushStatus === "error" ? "text-accent" : "text-text-muted"
                    }`}
                  >
                    {pushMessage}
                  </p>
                ) : null}
              </div>
              <Toggle
                checked={pushEnabled}
                disabled={pushStatus === "requesting" || pushStatus === "disabling"}
                onChange={setPush}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
