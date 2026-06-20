"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Mic } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_WELCOME =
  "Hallo! Schreib mir kurz, was du heute brauchst – ich passe deinen Trainingsplan an und beantworte Fragen zum Training.";

const QUICK_REPLIES = [
  "Was steht heute an?",
  "Erkläre meinen Plan",
  "Ich bin müde heute",
];

export const PLAN_UPDATED_EVENT = "ascend-plan-updated";

function formatTime(date) {
  return new Date(date).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatInterface({ initialPrompt = null }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [supportsSpeech, setSupportsSpeech] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [nachrichtenInfo, setNachrichtenInfo] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const initialSent = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupportsSpeech(!!SpeechRecognition);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileAndCreateGreeting() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profil } = await supabase
          .from("profiles")
          .select("vorname, hauptziel, ziel_datum")
          .eq("id", user.id)
          .single();

        if (!cancelled && profil?.vorname) {
          const stunde = new Date().getHours();
          const tageszeit = stunde < 12 ? 'Morgen' : stunde < 18 ? 'Tag' : 'Abend';
          
          const istGesundheitsziel = ['gesund bleiben', 'abnehmen', 'fit bleiben'].includes(profil.hauptziel?.toLowerCase());
          
          const begruessung = `Guten ${tageszeit}, ${profil.vorname}! ${
            profil.hauptziel && !istGesundheitsziel 
              ? `Du trainierst für ${profil.hauptziel}${profil.ziel_datum ? ` am ${new Date(profil.ziel_datum).toLocaleDateString('de-DE')}` : ''}.` 
              : 'Du trainierst für deine Gesundheit – das beste Ziel.'
          }
Was kann ich heute für dich tun?`;
          
          setWelcomeMessage(begruessung);
        }
      } catch (err) {
        console.error("Fehler beim Laden des Profils für Begrüßung:", err);
      }
    }

    loadProfileAndCreateGreeting();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    let cancelled = false;

    async function ladeLimit() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("nachrichten_heute, nachrichten_limit, nachrichten_reset_datum")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        const heute = new Date().toISOString().split("T")[0];
        const nachrichtenHeute =
          data?.nachrichten_reset_datum === heute
            ? data?.nachrichten_heute || 0
            : 0;
        const nachrichtenLimit = data?.nachrichten_limit || 10;

        if (!cancelled) {
          setNachrichtenInfo({
            nachrichten_heute: nachrichtenHeute,
            nachrichten_limit: nachrichtenLimit,
          });
          setLimitReached(nachrichtenHeute >= nachrichtenLimit);
        }
      } catch (err) {
        console.error("Fehler beim Laden des Nachrichtenlimits:", err);
      }
    }

    ladeLimit();

    return () => {
      cancelled = true;
    };
  }, []);

  const notifyPlanUpdated = useCallback(() => {
    window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
    router.refresh();
  }, [router]);

  const resetTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || sending || limitReached) return;

    setError(null);
    setShowQuickReplies(false);
    const userMessage = {
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    resetTextareaHeight();
    setSending(true);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        },
      ]);

      if (data.nachrichtenInfo) {
        setNachrichtenInfo(data.nachrichtenInfo);
        setLimitReached(!!data.limitReached);
      } else {
        setNachrichtenInfo((prev) => {
          if (!prev) return prev;
          const nextCount = (prev.nachrichten_heute || 0) + 1;
          const nextLimit = prev.nachrichten_limit || 10;
          setLimitReached(nextCount >= nextLimit);
          return {
            ...prev,
            nachrichten_heute: nextCount,
          };
        });
      }

      if (data.actionExecuted) {
        setActionFeedback("✓ Kalender aktualisiert");
        setTimeout(() => setActionFeedback(""), 3000);
      }

      if (data.planUpdated) {
        notifyPlanUpdated();
      }
    } catch (err) {
      // Prüfe auf globales Limit (Status 429 mit globalLimitReached)
      if (res.status === 429 && err.message?.includes("außergewöhnlich gefragt")) {
        setError("Ascend ist heute außergewöhnlich gefragt. Bitte versuche es morgen wieder.");
        setLimitReached(true);
      } else {
        setError(err.message);
      }
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
      setIsTyping(false);
    }
  }, [limitReached, messages, notifyPlanUpdated, resetTextareaHeight, sending]);

  useEffect(() => {
    if (initialPrompt && !initialSent.current) {
      initialSent.current = true;
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, sendMessage]);

  async function handleSend(e) {
    if (e) e.preventDefault();
    await sendMessage(input);
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  function startRecording() {
    if (sending || isRecording || limitReached) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Dein Browser unterstützt keine Spracheingabe. Bitte nutze Chrome."
      );
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setInput(transcript);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height =
              Math.min(inputRef.current.scrollHeight, 120) + "px";
            inputRef.current.focus();
          }
        });
      }
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error("Spracheingabe Fehler:", event.error);
      setIsRecording(false);
      if (event.error === "not-allowed") {
        alert(
          "Bitte erlaube den Mikrofonzugriff in deinen Browser-Einstellungen."
        );
      } else if (event.error === "no-speech") {
        alert("Keine Sprache erkannt. Bitte versuche es erneut.");
      } else if (event.error === "network") {
        alert(
          "Spracheingabe benötigt eine Netzwerkverbindung. Bitte nutze Chrome oder prüfe deine Verbindung."
        );
      } else if (event.error !== "aborted") {
        alert(
          "Spracheingabe fehlgeschlagen. Bitte nutze Chrome und erlaube den Mikrofonzugriff."
        );
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("Spracheingabe start:", err);
      setIsRecording(false);
      recognitionRef.current = null;
      alert(
        "Spracheingabe konnte nicht gestartet werden. Bitte nutze Chrome."
      );
    }
  }

  return (
    <div className="animate-fade-up-delay-1 flex h-[calc(100vh-14rem)] min-h-[420px] flex-col rounded-md border border-border bg-surface">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-md border border-border bg-surface-elevated px-4 py-3 sm:max-w-[75%]">
            <p className="text-sm leading-relaxed text-text">{welcomeMessage}</p>
            <span
              className="mt-1 block text-[10px] text-[#444]"
              style={{ marginTop: "4px" }}
            >
              {formatTime(new Date())}
            </span>
          </div>
        </div>

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[85%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "animate-slide-in-right border border-accent/30 bg-[#3d1512] text-text"
                  : "animate-slide-in-left border border-border bg-surface-elevated text-text"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <span
                className="block text-[10px] text-[#444]"
                style={{ marginTop: "4px" }}
              >
                {formatTime(msg.timestamp || new Date())}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "12px 16px",
              alignItems: "center",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#e63228",
                  animation: "typing 1.2s infinite",
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
        )}

        {showQuickReplies && messages.length <= 1 && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              padding: "0 16px 12px",
            }}
          >
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => {
                  setInput(reply);
                  setShowQuickReplies(false);
                  requestAnimationFrame(() => {
                    if (inputRef.current) {
                      inputRef.current.style.height = "auto";
                      inputRef.current.style.height =
                        Math.min(inputRef.current.scrollHeight, 120) + "px";
                      inputRef.current.focus();
                    }
                  });
                }}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "20px",
                  color: "#fff",
                  padding: "10px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                  minHeight: "44px",
                  minWidth: "44px",
                }}
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <p className="border-t border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      {actionFeedback && (
        <div className="border-t border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400 animate-slide-in-left">
          {actionFeedback}
        </div>
      )}

      {limitReached && (
        <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          Du hast dein Tageslimit erreicht. Morgen geht es weiter! 💪
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-border p-4"
      >
        <textarea
          data-tutorial="chat-input"
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            limitReached
              ? "Limit erreicht · Reset um Mitternacht"
              : "Schreib deinem Coach..."
          }
          disabled={sending || limitReached}
          rows={1}
          className="input-field flex-1"
          style={{
            resize: "none",
            overflow: "hidden",
            minHeight: "44px",
            maxHeight: "120px",
          }}
        />
        <button
          type="button"
          onClick={startRecording}
          disabled={sending || isRecording || !supportsSpeech || limitReached}
          title={
            limitReached
              ? "Limit erreicht · Reset um Mitternacht"
              : !supportsSpeech
              ? "Spracheingabe wird in diesem Browser nicht unterstützt. Bitte Chrome nutzen."
              : isRecording
                ? "Aufnahme läuft …"
                : "Spracheingabe (Mikrofon)"
          }
          aria-label={
            limitReached
              ? "Limit erreicht"
              : !supportsSpeech
              ? "Spracheingabe nicht verfügbar"
              : isRecording
                ? "Spracheingabe aktiv"
                : "Spracheingabe starten"
          }
          className={`touch-target flex shrink-0 items-center justify-center rounded-md px-4 transition-all min-h-[44px] min-w-[44px] ${
            !supportsSpeech
              ? "cursor-not-allowed border border-border bg-surface opacity-40"
              : isRecording
                ? "border border-accent bg-accent/20 text-accent animate-pulse shadow-[0_0_12px_rgba(230,50,40,0.45)]"
                : "border border-border bg-surface text-white hover:border-accent/50 hover:text-white"
          }`}
        >
          <Mic
            size={18}
            strokeWidth={2.5}
            className={isRecording ? "text-accent" : undefined}
          />
        </button>
        <button
          type="submit"
          disabled={sending || limitReached || !input.trim()}
          className="btn-primary flex items-center gap-2 px-5"
        >
          <Send size={18} strokeWidth={2.5} />
          <span className="hidden sm:inline">Senden</span>
        </button>
      </form>

      {nachrichtenInfo && (
        <div
          className={`px-4 pb-3 text-center text-[11px] ${
            nachrichtenInfo.nachrichten_heute >= nachrichtenInfo.nachrichten_limit * 0.8
              ? "text-accent"
              : "text-text/60"
          }`}
        >
          {nachrichtenInfo.nachrichten_heute} / {nachrichtenInfo.nachrichten_limit} Nachrichten heute
          {nachrichtenInfo.nachrichten_heute >= nachrichtenInfo.nachrichten_limit * 0.8
            ? " · Reset um Mitternacht"
            : ""}
        </div>
      )}
    </div>
  );
}
