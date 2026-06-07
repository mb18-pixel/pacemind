"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Mic } from "lucide-react";

const WELCOME =
  "Hallo! Ich bin dein PaceMind Laufcoach. Ich kenne deinen Trainingsplan, deine Zeitslots, Läufe und das Wetter – frag mich alles zum Training.";

export const PLAN_UPDATED_EVENT = "pacemind-plan-updated";

export default function ChatInterface({ initialPrompt = null }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [supportsSpeech, setSupportsSpeech] = useState(null);
  const bottomRef = useRef(null);
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (initialPrompt && !initialSent.current) {
      initialSent.current = true;
      sendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  function notifyPlanUpdated() {
    window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
    router.refresh();
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    setError(null);
    const userMessage = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

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
        { role: "assistant", content: data.reply },
      ]);

      if (
        data.planUpdated ||
        data.action?.type === "plan_day_updated" ||
        data.action?.type === "plan_replanned"
      ) {
        notifyPlanUpdated();
      }
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await sendMessage(input);
  }

  function startRecording() {
    if (loading || isRecording) return;

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
          inputRef.current?.focus();
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
            <p className="text-sm leading-relaxed text-text">{WELCOME}</p>
          </div>
        </div>

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-md px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                msg.role === "user"
                  ? "animate-slide-in-right border border-accent/30 bg-[#3d1512] text-text"
                  : "animate-slide-in-left border border-border bg-surface-elevated text-text"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-slide-in-left">
            <div className="rounded-md border border-border bg-surface-elevated px-4 py-3">
              <span className="inline-flex gap-1 text-accent">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce [animation-delay:0.15s]">●</span>
                <span className="animate-bounce [animation-delay:0.3s]">●</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="border-t border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-border p-4"
      >
        <input
          data-tutorial="chat-input"
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frage deinen Laufcoach …"
          disabled={loading}
          className="input-field flex-1"
        />
        <button
          type="button"
          onClick={startRecording}
          disabled={loading || isRecording || !supportsSpeech}
          title={
            !supportsSpeech
              ? "Spracheingabe wird in diesem Browser nicht unterstützt. Bitte Chrome nutzen."
              : isRecording
                ? "Aufnahme läuft …"
                : "Spracheingabe (Mikrofon)"
          }
          aria-label={
            !supportsSpeech
              ? "Spracheingabe nicht verfügbar"
              : isRecording
                ? "Spracheingabe aktiv"
                : "Spracheingabe starten"
          }
          className={`flex shrink-0 items-center justify-center rounded-md px-4 transition-all ${
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
          disabled={loading || !input.trim()}
          className="btn-primary flex items-center gap-2 px-5"
        >
          <Send size={18} strokeWidth={2.5} />
          <span className="hidden sm:inline">Senden</span>
        </button>
      </form>
    </div>
  );
}
