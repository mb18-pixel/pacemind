import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WOCHENTAG_VOLL = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) return jsonResponse({ error: authError.message }, 401);
    if (!user) return jsonResponse({ error: "Nicht angemeldet" }, 401);

    const { data, error } = await supabase
      .from("training_slots")
      .select("*")
      .eq("user_id", user.id)
      .order("wochentag", { ascending: true });

    if (error) {
      console.error("Training slots fetch error:", error);
      return jsonResponse(
        { error: error.message || "Trainingslots konnten nicht geladen werden" },
        500
      );
    }

    return jsonResponse({ slots: data });
  } catch (error) {
    console.error("Training slots API error:", error);
    return jsonResponse(
      { error: error.message || "Fehler beim Laden der Trainingslots" },
      500
    );
  }
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
    const { wochentag, verfuegbar, uhrzeit_start, uhrzeit_ende } = body;

    if (wochentag === undefined || wochentag === null) {
      return jsonResponse({ error: "Wochentag fehlt" }, 400);
    }
    if (wochentag < 0 || wochentag > 6) {
      return jsonResponse({ error: "Ungültiger Wochentag (0-6)" }, 400);
    }

    const { data, error } = await supabase
      .from("training_slots")
      .insert({
        user_id: user.id,
        wochentag,
        wochentag_name: WOCHENTAG_VOLL[wochentag] || null,
        verfuegbar: verfuegbar !== undefined ? verfuegbar : true,
        uhrzeit_start: uhrzeit_start || null,
        uhrzeit_ende: uhrzeit_ende || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Training slot create error:", error);
      return jsonResponse(
        { error: error.message || "Trainingslot konnte nicht erstellt werden" },
        500
      );
    }

    return jsonResponse({ success: true, slot: data }, 201);
  } catch (error) {
    console.error("Training slot create API error:", error);
    return jsonResponse(
      { error: error.message || "Trainingslot konnte nicht erstellt werden" },
      500
    );
  }
}

export async function PUT(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) return jsonResponse({ error: authError.message }, 401);
    if (!user) return jsonResponse({ error: "Nicht angemeldet" }, 401);

    const body = await request.json();
    const { slots } = body;

    if (!Array.isArray(slots)) {
      return jsonResponse({ error: "Slots-Array fehlt" }, 400);
    }

    await supabase.from("training_slots").delete().eq("user_id", user.id);

    const active = slots.filter((s) => s.verfuegbar);
    if (active.length > 0) {
      const rows = active.map((s) => ({
        user_id: user.id,
        wochentag: s.wochentag,
        wochentag_name: WOCHENTAG_VOLL[s.wochentag] || null,
        verfuegbar: true,
        uhrzeit_start: s.uhrzeit_start || null,
        uhrzeit_ende: s.uhrzeit_ende || null,
      }));

      const { data, error } = await supabase
        .from("training_slots")
        .insert(rows)
        .select();

      if (error) throw error;

      await supabase
        .from("profiles")
        .update({ trainingstage: String(active.length) })
        .eq("id", user.id);

      return jsonResponse({ success: true, slots: data });
    }

    await supabase
      .from("profiles")
      .update({ trainingstage: "0" })
      .eq("id", user.id);

    return jsonResponse({ success: true, slots: [] });
  } catch (error) {
    console.error("Training slots bulk update error:", error);
    return jsonResponse(
      { error: error.message || "Trainingszeiten konnten nicht gespeichert werden" },
      500
    );
  }
}

export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) return jsonResponse({ error: authError.message }, 401);
    if (!user) return jsonResponse({ error: "Nicht angemeldet" }, 401);

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("id");

    if (!slotId) {
      return jsonResponse({ error: "Slot-ID fehlt" }, 400);
    }

    const { error } = await supabase
      .from("training_slots")
      .delete()
      .eq("id", slotId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Training slot delete error:", error);
      return jsonResponse(
        { error: error.message || "Trainingslot konnte nicht gelöscht werden" },
        500
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Training slot delete API error:", error);
    return jsonResponse(
      { error: error.message || "Trainingslot konnte nicht gelöscht werden" },
      500
    );
  }
}
