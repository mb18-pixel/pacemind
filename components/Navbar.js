"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Footprints, LogOut, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import InstallAppModal from "@/components/InstallAppModal";

const links = [
  { href: "/chat", label: "Coach", icon: MessageSquare },
  { href: "/kalender", label: "Kalender", icon: Calendar, tutorial: "nav-kalender" },
  { href: "/laeufe", label: "Läufe", icon: Footprints, tutorial: "nav-laeufe" },
];

const authPaths = ["/login", "/register", "/consent", "/onboarding"];

const INSTALLED_KEY = "installBannerInstalled";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = authPaths.includes(pathname);

  const [installOpen, setInstallOpen] = useState(false);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1";
  });
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial check (falls SW/DOM später ready ist)
    Promise.resolve().then(() => {
      setInstalled(isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1");
    });

    const bipHandler = (e) => {
      // Android/Chrome: beforeinstallprompt
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", bipHandler);

    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setInstalled(true);
      setDeferredPrompt(null);
      setInstallOpen(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    const openInstallModalHandler = () => {
      if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1") return;
      setInstallOpen(true);
    };
    window.addEventListener("pacemind-open-install-modal", openInstallModalHandler);

    const mq = window.matchMedia?.("(display-mode: standalone)");
    const mqHandler = (e) => {
      if (e.matches) {
        localStorage.setItem(INSTALLED_KEY, "1");
        setInstalled(true);
        setInstallOpen(false);
      }
    };
    mq?.addEventListener?.("change", mqHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", bipHandler);
      window.removeEventListener("appinstalled", installedHandler);
      window.removeEventListener("pacemind-open-install-modal", openInstallModalHandler);
      mq?.removeEventListener?.("change", mqHandler);
    };
  }, []);

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
              PaceMind
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
              PaceMind
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
            PaceMind
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

          {!installed && !isStandalone() ? (
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              data-tutorial="nav-install"
              className="flex items-center gap-1.5 rounded-md border border-border/40 bg-surface-elevated/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-text transition-all duration-200 hover:border-accent hover:text-white sm:px-4 sm:text-sm"
            >
              <span aria-hidden>📲</span>
              <span>App installieren</span>
            </button>
          ) : null}

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

      <InstallAppModal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstalled={() => {
          localStorage.setItem(INSTALLED_KEY, "1");
          setInstalled(true);
          setInstallOpen(false);
        }}
      />
    </header>
  );
}
