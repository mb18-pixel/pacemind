import CalendarView from "@/components/CalendarView";
import { Calendar } from "lucide-react";

export const metadata = {
  title: "Trainingskalender – PaceMind",
};

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
            <Calendar size={20} className="text-accent" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
              Trainingskalender
            </h1>
            <p className="text-sm text-text-muted">
              Dein Plan ist mit dem Coach verbunden – Änderungen im Chat
              erscheinen hier sofort.
            </p>
          </div>
        </div>
      </div>
      <CalendarView />
    </div>
  );
}
