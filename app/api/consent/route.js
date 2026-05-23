import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return jsonResponse({ error: authError.message }, 401);
    }

    if (!user) {
      return jsonResponse({ error: "Nicht angemeldet" }, 401);
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          privacy_accepted_at: now,
          age_confirmed_at: now,
        },
        { onConflict: "id" }
      )
      .select("privacy_accepted_at, age_confirmed_at")
      .single();

    if (error) {
      console.error("Consent DB error:", error);
      return jsonResponse(
        { error: error.message || "Einwilligung konnte nicht gespeichert werden" },
        500
      );
    }

    return jsonResponse({
      success: true,
      privacy_accepted_at: data.privacy_accepted_at,
      age_confirmed_at: data.age_confirmed_at,
    });
  } catch (error) {
    console.error("Consent API error:", error);
    return jsonResponse(
      { error: error.message || "Einwilligung konnte nicht gespeichert werden" },
      500
    );
  }
}
