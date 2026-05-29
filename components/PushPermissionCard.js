"use client";

import { useMemo, useState } from "react";

const DISMISS_KEY = "pushPermissionDismissed";

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

export default function PushPermissionCard() {
  const [status, setStatus] = useState("idle"); // idle | requesting | granted | error
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });

  const shouldShow = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
    if (dismissed) return false;
    return Notification.permission === "default";
  }, [dismissed]);

  function dismissForever() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function enable() {
    setStatus("requesting");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismissForever();
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt");
      }

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
      if (!res.ok) throw new Error(data?.error || "Subscription konnte nicht gespeichert werden");

      setStatus("granted");
      setMessage("Erinnerungen aktiviert ✓");
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    } catch (e) {
      setStatus("error");
      setMessage(e.message || "Push konnte nicht aktiviert werden");
    }
  }

  if (!shouldShow) return null;

  return (
    <div className="rounded-md border border-border bg-surface-elevated p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-text">🔔 Trainings-Erinnerungen aktivieren?</p>
          <p className="text-sm text-text-muted">
            Dein Coach benachrichtigt dich bei wichtigen Updates.
          </p>
          {message ? (
            <p
              className={`mt-2 text-sm ${
                status === "error" ? "text-accent" : "text-text-muted"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={dismissForever}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text-muted hover:bg-surface"
          >
            Nein danke
          </button>
          <button
            onClick={enable}
            disabled={status === "requesting"}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            Aktivieren
          </button>
        </div>
      </div>
    </div>
  );
}
