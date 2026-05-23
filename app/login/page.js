"use client";

import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    router.push("/chat");
    router.refresh();
  }

  return (
    <AuthForm
      title="Anmelden"
      subtitle="Melde dich an und starte dein Training."
      submitLabel="Anmelden"
      onSubmit={handleLogin}
      footerLink={{
        text: "Noch kein Konto?",
        label: "Registrieren",
        href: "/register",
      }}
    />
  );
}
