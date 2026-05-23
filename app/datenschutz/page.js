import { Shield } from "lucide-react";

export const metadata = {
  title: "Datenschutz – PaceMind",
};

export default function DatenschutzPage() {
  return (
    <article className="animate-fade-up card-elevated border-t-2 border-t-accent p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
          <Shield size={20} className="text-accent" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
          Datenschutz
        </h1>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-text-muted">
        Diese Seite kannst du später mit deiner Datenschutzerklärung füllen.
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-accent">
        PerformanceProtokoll
      </p>
    </article>
  );
}
