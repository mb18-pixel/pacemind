"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackWidget() {
  const pathname = usePathname();
  const [offen, setOffen] = useState(false);
  const [nachricht, setNachricht] = useState("");
  const [gesendet, setGesendet] = useState(false);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState("");
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (pathname.startsWith('/onboarding') || pathname === '/chat') {
    return null;
  }

  async function handleSenden() {
    if (!nachricht.trim() || laden) return;

    setLaden(true);
    setFehler("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        nachricht: nachricht.trim(),
        seite: window.location.pathname,
      });

      if (error) throw error;

      setGesendet(true);
      setNachricht("");

      timeoutRef.current = setTimeout(() => {
        setGesendet(false);
        setOffen(false);
      }, 2000);
    } catch (err) {
      console.error("Feedback konnte nicht gesendet werden:", err);
      setFehler("Feedback konnte gerade nicht gesendet werden.");
    } finally {
      setLaden(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "8px",
      }}
    >
      <div
        aria-hidden={!offen}
        style={{
          background: "#111111",
          border: "1px solid #222",
          borderRadius: "12px",
          padding: "16px",
          width: "280px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          opacity: offen ? 1 : 0,
          transform: offen ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
          transformOrigin: "bottom right",
          pointerEvents: offen ? "auto" : "none",
          transition: "opacity 0.22s ease, transform 0.22s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            Dein Feedback ist uns wichtig!
          </span>
          <button
            onClick={() => {
              setOffen(false);
              setFehler("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
            }}
            aria-label="Feedback schließen"
          >
            ✕
          </button>
        </div>

        {gesendet ? (
          <div
            style={{
              color: "#22c55e",
              textAlign: "center",
              padding: "20px 0",
              fontSize: "14px",
            }}
          >
            Danke! Dein Feedback hilft uns. ✓
          </div>
        ) : (
          <>
            <p
              style={{
                color: "#d4d4d4",
                fontSize: "13px",
                lineHeight: 1.45,
                margin: "0 0 12px 0",
              }}
            >
              Was denkst du über Ascend? Wir stehen erst ganz am Anfang und würden
              uns über dein Feedback freuen!
            </p>

            <textarea
              value={nachricht}
              onChange={(e) => setNachricht(e.target.value)}
              placeholder="Nachricht..."
              rows={4}
              style={{
                width: "100%",
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "10px",
                color: "#fff",
                fontSize: "13px",
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {fehler ? (
              <div
                style={{
                  color: "#f87171",
                  fontSize: "12px",
                  marginTop: "8px",
                }}
              >
                {fehler}
              </div>
            ) : null}

            <button
              onClick={handleSenden}
              disabled={!nachricht.trim() || laden}
              style={{
                marginTop: "10px",
                width: "100%",
                background: nachricht.trim() ? "#e63228" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: nachricht.trim() && !laden ? "pointer" : "default",
                transition: "background 0.2s ease",
              }}
            >
              {laden ? "Wird gesendet..." : "Senden →"}
            </button>
          </>
        )}
      </div>

      <button
        onClick={() => {
          setOffen((prev) => !prev);
          setFehler("");
          if (gesendet) setGesendet(false);
        }}
        className="hidden md:flex"
        style={{
          background: "#e63228",
          color: "#fff",
          border: "none",
          borderRadius: "20px",
          padding: "10px 16px",
          fontSize: "13px",
          fontWeight: "600",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: "0 4px 12px rgba(230,50,40,0.3)",
        }}
      >
        💬 Feedback
      </button>
    </div>
  );
}
