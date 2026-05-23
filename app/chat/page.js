import ChatInterface from "@/components/ChatInterface";
import { MessageSquare } from "lucide-react";

export const metadata = {
  title: "Coach-Chat – PaceMind",
};

export default function ChatPage() {
  return (
    <div className="space-y-6">
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
              Deine letzten 5 Läufe fließen in jede Antwort ein.
            </p>
          </div>
        </div>
      </div>
      <ChatInterface />
    </div>
  );
}
