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
    const {
      vorname,
      geschlecht,
      alterJahre,
      koerperfettanteil,
      stadt,
      land,
      latitude,
      longitude,
      fitnesslevel,
      ziel,
      zielDatum,
      zielPace,
      zielDistanz,
      zielzeit,
      aktuelleTrainingsfrequenz,
      aktuelleDistanz,
      zielzeitBerechnet,
      trainingstage,
      slots,
    } = body;

    if (!vorname?.trim()) {
      return jsonResponse({ error: "Vorname fehlt" }, 400);
    }
    if (!geschlecht) {
      return jsonResponse({ error: "Geschlecht fehlt" }, 400);
    }
    if (!alterJahre) {
      return jsonResponse({ error: "Alter fehlt" }, 400);
    }
    if (!stadt || latitude == null || longitude == null) {
      return jsonResponse({ error: "Standort unvollständig" }, 400);
    }
    if (!fitnesslevel || !ziel) {
      return jsonResponse({ error: "Trainingseinstellungen unvollständig" }, 400);
    }

    const trainingstageCount = Number(trainingstage);
    if (!trainingstageCount || trainingstageCount < 2) {
      return jsonResponse(
        { error: "Bitte wähle mindestens 2 Trainingstage" },
        400
      );
    }

    if (!Array.isArray(slots) || slots.length < 2) {
      return jsonResponse(
        { error: "Trainingszeiten unvollständig" },
        400
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        vorname: vorname.trim(),
        geschlecht,
        alter_jahre: Number(alterJahre),
        koerperfettanteil: koerperfettanteil
          ? Number(koerperfettanteil)
          : null,
        stadt: stadt.trim(),
        land: land?.trim() || null,
        latitude: Number(latitude),
        longitude: Number(longitude),
        fitnesslevel,
        ziel,
        ziel_datum: zielDatum || null,
        zielpace: zielPace || null,
        zieldistanz: zielDistanz || null,
        zielzeit: zielzeit || null,
        aktuelle_trainingsfrequenz: aktuelleTrainingsfrequenz || null,
        aktuelle_distanz: aktuelleDistanz || null,
        zielzeit_berechnet: zielzeitBerechnet || false,
        trainingstage: String(trainingstageCount),
        onboarding_abgeschlossen: true,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Onboarding DB error:", error);
      return jsonResponse(
        { error: error.message || "Onboarding konnte nicht gespeichert werden" },
        500
      );
    }

    await supabase.from("training_slots").delete().eq("user_id", user.id);

    const slotRows = slots.map((slot) => ({
      user_id: user.id,
      wochentag: slot.wochentag,
      verfuegbar: true,
      uhrzeit_start: slot.uhrzeit_start,
      uhrzeit_ende: slot.uhrzeit_ende,
    }));

    const { error: slotsError } = await supabase
      .from("training_slots")
      .insert(slotRows);

    if (slotsError) {
      console.error("Training slots save error:", slotsError);
      return jsonResponse(
        { error: slotsError.message || "Trainingszeiten konnten nicht gespeichert werden" },
        500
      );
    }

    return jsonResponse({ success: true, profile: data });
  } catch (error) {
    console.error("Onboarding API error:", error);
    return jsonResponse(
      { error: error.message || "Onboarding konnte nicht gespeichert werden" },
      500
    );
  }
}
