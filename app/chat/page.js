"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import PushPermissionCard from "@/components/PushPermissionCard";
import WeeklyRecapCard from "@/components/WeeklyRecapCard";
import ChatTutorialGate from "@/components/ChatTutorialGate";
import { MessageSquare } from "lucide-react";

function ChatContent() {
  const searchParams = useSearchParams();
  const context = searchParams.get("context");

  return (
    <div className="space-y-6">
      <ChatTutorialGate />
      <div className="animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
            <MessageSquare size={20} className="text-accent" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
              Coach-Chat
            </h1>
            <p className="text-sm text-text-muted">
              Verbunden mit Kalender, Zeitslots, Läufen und Wetter.
            </p>
          </div>
        </div>
      </div>
      <WeeklyRecapCard />
      <PushPermissionCard />
      <ChatInterface initialPrompt={context} />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={<p className="text-text-muted">Coach wird geladen …</p>}
    >
      <ChatContent />
    </Suspense>
  );
}
