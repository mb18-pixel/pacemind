"use client";

import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

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

    router.push("/login?registered=1");
    router.refresh();
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
