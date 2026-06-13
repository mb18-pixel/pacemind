"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Footprints, LogOut, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/chat", label: "Coach", icon: MessageSquare },
  { href: "/laeufe", label: "Läufe", icon: Footprints, tutorial: "nav-laeufe" },
];

const authPaths = ["/login", "/register", "/consent", "/onboarding"];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = authPaths.includes(pathname);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (pathname === "/") {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/10 bg-bg/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="group shrink-0">
            <span className="text-lg font-black uppercase tracking-tight text-text sm:text-xl">
              Ascend
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-accent sm:text-xs">
              by PerformanceProtokoll
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md border border-border/40 bg-surface-elevated/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-text transition-all duration-200 hover:border-accent hover:text-white sm:px-4 sm:py-2 sm:text-sm"
            >
              Anmelden
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_15px_rgba(230,50,40,0.5)] sm:px-4 sm:py-2 sm:text-sm"
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
            <span className="text-xl font-extrabold uppercase tracking-tight text-text">
              Ascend
            </span>
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
    <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/chat" className="group shrink-0">
          <span className="text-lg font-extrabold uppercase tracking-tight text-text sm:text-xl">
            Ascend
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-accent sm:text-xs">
            by PerformanceProtokoll
          </span>
          <span className="mt-1.5 block h-0.5 w-full max-w-[120px] rounded-sm bg-accent animate-heartbeat" />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                data-tutorial={link.tutorial}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200 sm:px-4 sm:text-sm ${
                  active
                    ? "bg-accent text-white"
                    : "text-text-muted hover:bg-surface-elevated hover:text-text"
                }`}
              >
                <Icon size={16} strokeWidth={2.5} />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-muted transition-all duration-200 hover:bg-surface-elevated hover:text-accent sm:px-4 sm:text-sm"
          >
            <LogOut size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
