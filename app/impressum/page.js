import { FileText } from "lucide-react";

export const metadata = {
  title: "Impressum – Ascend",
};

export default function ImpressumPage() {
  return (
    <article className="animate-fade-up card-elevated border-t-2 border-t-accent p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
          <FileText size={20} className="text-accent" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
          Impressum
        </h1>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-text-muted">
        Diese Seite kannst du später mit deinen rechtlichen Angaben füllen.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-text-muted">
        Kontakt: <a href="mailto:mail.ascend@gmx.de" className="text-accent hover:underline">mail.ascend@gmx.de</a>
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-accent">
        PerformanceProtokoll
      </p>
    </article>
  );
}
