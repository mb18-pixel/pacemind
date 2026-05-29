import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) return jsonResponse({ error: authError.message }, 401);
    if (!user) return jsonResponse({ error: "Nicht angemeldet" }, 401);

    const body = await request.json();

    const { data, error } = await supabase
      .from("profiles")
      .update(body)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return jsonResponse(
        { error: error.message || "Profil konnte nicht aktualisiert werden" },
        500
      );
    }

    return jsonResponse({ success: true, profile: data });
  } catch (error) {
    console.error("Profile update API error:", error);
    return jsonResponse(
      { error: error.message || "Profil konnte nicht aktualisiert werden" },
      500
    );
  }
}
