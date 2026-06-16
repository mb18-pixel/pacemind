"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-center text-sm text-text-muted">
          Ascend ist ein kostenloses Tool der{" "}
          <span className="font-semibold text-text">PerformanceProtokoll</span>{" "}
          Community
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold uppercase tracking-wide">
          <Link
            href="/impressum"
            className="touch-target text-text-muted transition-colors hover:text-accent py-2"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="touch-target text-text-muted transition-colors hover:text-accent py-2"
          >
            Datenschutz
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-accent" />
          <p className="text-center text-xs text-text-muted">
            Ascend ersetzt keine medizinische Beratung.
          </p>
          <span className="h-px w-8 bg-accent" />
        </div>
      </div>
    </footer>
  );
}
