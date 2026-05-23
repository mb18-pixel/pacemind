"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import AuthForm from "@/components/AuthForm";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [registrationComplete, setRegistrationComplete] = useState(false);

  async function handleRegister({ email, password }) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/consent`,
      },
    });

    if (error) throw error;

    const { data: session } = await supabase.auth.getSession();
    if (session.session) {
      router.push("/consent");
      router.refresh();
      return;
    }

    setRegistrationComplete(true);
  }

  if (registrationComplete) {
    return (
      <div className="relative flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-md bg-accent/10 blur-3xl" />
          <div className="absolute -left-20 bottom-1/4 h-64 w-2 rotate-12 bg-accent" />
        </div>

        <div className="animate-fade-up relative w-full max-w-lg">
          <div className="card-elevated border-t-4 border-t-accent p-8 sm:p-10">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-accent/15 shadow-[0_0_32px_rgba(230,50,40,0.25)]">
                <CheckCircle2
                  size={36}
                  className="text-accent"
                  strokeWidth={2.5}
                />
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-widest text-accent">
                PerformanceProtokoll
              </p>

              <h1 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
                Registrierung erfolgreich!
              </h1>

              <div className="mt-6 flex items-start gap-3 rounded-md border border-border bg-surface p-5 text-left">
                <Mail
                  size={22}
                  className="mt-0.5 shrink-0 text-accent"
                  strokeWidth={2.5}
                />
                <p className="text-base leading-relaxed text-text sm:text-lg">
                  Wir haben dir eine Bestätigungs-E-Mail geschickt. Bitte öffne
                  den Link in der E-Mail, um dein Konto zu aktivieren. Danach
                  kannst du dich hier anmelden.
                </p>
              </div>

              <Link href="/login" className="btn-primary mt-8 w-full sm:w-auto">
                Zum Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthForm
      title="Registrieren"
      subtitle="Werde Teil der PerformanceProtokoll Community."
      submitLabel="Konto erstellen"
      onSubmit={handleRegister}
      footerLink={{
        text: "Bereits ein Konto?",
        label: "Anmelden",
        href: "/login",
      }}
    />
  );
}
