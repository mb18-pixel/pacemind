"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Footprints,
  LogOut,
  MessageSquare,
  Calendar,
  MoreHorizontal,
  X,
  FileText,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/chat", label: "Coach", icon: MessageSquare },
  { href: "/kalender", label: "Kalender", icon: Calendar },
  { href: "/laeufe", label: "Läufe", icon: Footprints, tutorial: "nav-laeufe" },
];

const authPaths = ["/login", "/register", "/consent", "/onboarding"];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAuthPage = authPaths.includes(pathname);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMoreOpen(false);
    router.push("/login");
    router.refresh();
  }

  if (pathname === "/") {
    return (
      <header className="fixed top-0 left-0 right-0 border-b border-border/10 bg-bg/50 backdrop-blur-md" style={{ zIndex: 20 }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="group shrink-0">
            <span className="page-title text-lg sm:text-xl">Ascend</span>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-accent sm:text-xs">
              by PerformanceProtokoll
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="touch-target rounded-md border border-border/40 bg-surface-elevated/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-text transition-all duration-200 hover:border-accent hover:text-white sm:px-4 sm:text-sm"
            >
              Anmelden
            </Link>
            <Link
              href="/register"
              className="touch-target rounded-md bg-accent px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_15px_rgba(230,50,40,0.5)] sm:px-4 sm:text-sm"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </header>
    );
  }

  if (isAuthPage) {
    return (
      <header className="border-b border-border bg-bg">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/login" className="group inline-block">
            <span className="page-title text-xl">Ascend</span>
            <span className="mt-0.5 block text-xs font-semibold uppercase tracking-widest text-accent">
              by PerformanceProtokoll
            </span>
            <span className="mt-2 block h-0.5 w-full origin-left rounded-sm bg-accent animate-heartbeat" />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="sticky top-0 hidden border-b border-border bg-bg/95 backdrop-blur-sm md:block" style={{ zIndex: 20 }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/chat" className="group shrink-0">
            <span className="page-title text-xl">Ascend</span>
            <span className="block text-xs font-semibold uppercase tracking-widest text-accent">
              by PerformanceProtokoll
            </span>
            <span className="mt-1.5 block h-0.5 w-full max-w-[120px] rounded-sm bg-accent animate-heartbeat" />
          </Link>

          <nav className="flex items-center gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-tutorial={link.tutorial}
                  className={`touch-target flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
                    active
                      ? "bg-accent text-white"
                      : "text-text-muted hover:bg-surface-elevated hover:text-text"
                  }`}
                >
                  <Icon size={16} strokeWidth={2.5} />
                  {link.label}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={handleLogout}
              className="touch-target flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide text-text-muted transition-all duration-200 hover:bg-surface-elevated hover:text-accent"
            >
              <LogOut size={16} strokeWidth={2.5} />
              Logout
            </button>
          </nav>
        </div>
      </header>

      <header className="sticky top-0 border-b border-border bg-bg/95 backdrop-blur-sm md:hidden" style={{ zIndex: 20 }}>
        <div className="flex items-center justify-center px-4 py-3">
          <Link href="/chat" className="text-center">
            <span className="text-base font-extrabold uppercase tracking-tight text-text">
              Ascend
            </span>
          </Link>
        </div>
      </header>

      <nav className="bottom-nav md:hidden">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              data-tutorial={link.tutorial}
              className={`bottom-nav-item ${active ? "bottom-nav-item-active" : ""}`}
            >
              <Icon size={22} strokeWidth={2.5} />
              <span>{link.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`bottom-nav-item ${moreOpen ? "bottom-nav-item-active" : ""}`}
        >
          <MoreHorizontal size={22} strokeWidth={2.5} />
          <span>Mehr</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="modal-overlay md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="bottom-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottom-sheet-handle" />
            <div className="flex items-center justify-between px-4 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-text">Mehr</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="touch-target rounded-md p-2 text-text-muted hover:text-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-1 px-4 pb-6">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  window.dispatchEvent(new Event('ascend:open-feedback'));
                }}
                className="touch-target flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-text hover:bg-surface-elevated w-full text-left"
              >
                <MessageSquare size={18} />
                Feedback geben
              </button>
              <Link
                href="/impressum"
                onClick={() => setMoreOpen(false)}
                className="touch-target flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-text hover:bg-surface-elevated"
              >
                <FileText size={18} />
                Impressum
              </Link>
              <Link
                href="/datenschutz"
                onClick={() => setMoreOpen(false)}
                className="touch-target flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-text hover:bg-surface-elevated"
              >
                <Shield size={18} />
                Datenschutz
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="touch-target flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-accent hover:bg-accent/10"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
