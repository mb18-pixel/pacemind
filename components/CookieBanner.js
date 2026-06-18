"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const AUTH_PATHS = ["/login", "/register", "/consent", "/onboarding"];

export default function CookieBanner() {
  const pathname = usePathname();
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    // Don't show on auth/onboarding pages – the banner overlays action buttons
    if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      setSichtbar(false);
      return;
    }
    const akzeptiert = localStorage.getItem("cookies_akzeptiert");
    if (!akzeptiert) setSichtbar(true);
  }, [pathname]);

  function akzeptieren() {
    localStorage.setItem("cookies_akzeptiert", "true");
    setSichtbar(false);
  }

  if (!sichtbar) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#111",
        borderTop: "1px solid #222",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        zIndex: 9999,
        flexWrap: "wrap",
      }}
    >
      <p
        style={{
          color: "#ccc",
          fontSize: "13px",
          margin: 0,
          flex: 1,
        }}
      >
        Wir nutzen technisch notwendige Cookies für deinen Login und
        App-Einstellungen. Keine Tracking- oder Werbe-Cookies.{" "}
        <a href="/datenschutz" style={{ color: "#e63228" }}>
          Datenschutz
        </a>
      </p>
      <button
        onClick={akzeptieren}
        style={{
          background: "#e63228",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "10px 20px",
          fontSize: "13px",
          fontWeight: "600",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Verstanden
      </button>
    </div>
  );
}
