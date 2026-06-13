import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/chat";

  // Validierung: nur relative Pfade erlauben
  const isValidPath = (path) => {
    return path.startsWith("/") && 
           !path.startsWith("//") && 
           !path.includes("://");
  };

  const next = isValidPath(nextParam) ? nextParam : "/chat";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
