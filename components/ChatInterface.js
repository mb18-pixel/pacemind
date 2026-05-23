"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

const WELCOME =
  "Hallo! Ich bin dein PaceMind Laufcoach. Frag mich zu Training, Pace, Erholung oder deinen letzten Läufen – ich kenne deine eingetragenen Daten.";

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    const userMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frage deinen Laufcoach …"
          disabled={loading}
          className="input-field flex-1"
        />
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
