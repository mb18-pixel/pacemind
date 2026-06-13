import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getProfileForUser } from "@/lib/profile-server";
import { getTrainingSlots, dateToWochentag, formatDateISO } from "@/lib/training-server";
import {
  computeAthleteLeistungsprofil,
  generateMacroSkeleton,
  generateMicrocycleForDates,
} from "@/lib/training-engine";

export const dynamic = "force-dynamic";

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function slotMinuten(start, ende) {
  // Offenes Zeitfenster (ohne Start/Ende) → keine harte Begrenzung
  if (!start || !ende) return null;
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(ende).split(":").map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  return eh * 60 + em - (sh * 60 + sm);
}

function getSimulatedToday(request) {
  if (process.env.NODE_ENV !== "development") return null;
  const iso = request.headers.get("x-simulated-date");
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
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

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "14");

    const startParam = searchParams.get("start");
    const startDate = (() => {
      const simulated = getSimulatedToday(request);
      if (simulated) return simulated;
      if (startParam) {
        const d = new Date(startParam);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          return d;
        }
      }
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + Math.max(0, days - 1));

    const { data, error } = await supabase
      .from("training_plan")
      .select("*")
      .eq("user_id", user.id)
      .gte("datum", formatDateISO(startDate))
      .lte("datum", formatDateISO(endDate))
      .order("datum", { ascending: true });

    if (error) {
      console.error("Training plan fetch error:", error);
      return jsonResponse(
        { error: error.message || "Trainingsplan konnte nicht geladen werden" },
        500
      );
    }

    return jsonResponse({ plan: data });
  } catch (error) {
    console.error("Training plan API error:", error);
    return jsonResponse(
      { error: error.message || "Fehler beim Laden des Trainingsplans" },
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
    const { plan, generate } = body;

    if (generate) {
      const simulatedToday = getSimulatedToday(request);
      const [profile, slots] = await Promise.all([
        getProfileForUser(supabase, user.id),
        getTrainingSlots(supabase, user.id),
      ]);

      const availableSlots = (slots || []).filter((s) => {
        if (!s.verfuegbar) return false;
        const mins = slotMinuten(s.uhrzeit_start, s.uhrzeit_ende);
        // Minimum: 20 Minuten (kürzere Slots ignorieren)
        return mins == null ? true : mins >= 20;
      });
      if (availableSlots.length === 0) {
        return jsonResponse(
          { error: "Keine Trainingszeitslots – bitte zuerst Zeiten hinterlegen" },
          400
        );
      }

      // Aktuelles Wochenvolumen (Ø letzte 4 Wochen) aus DB (letzte 28 Tage / 4)
      const today = (() => {
        if (simulatedToday) return simulatedToday;
        if (body?.start) {
          const d = new Date(body.start);
          if (!Number.isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            return d;
          }
        }
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();
      const since = new Date(today);
      since.setDate(since.getDate() - 28);

      const { data: runs28, error: runsError } = await supabase
        .from("runs")
        .select("distanz_km, created_at, pace")
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString());
      if (runsError) throw runsError;

      const sum28 = (runs28 || []).reduce(
        (acc, r) => acc + (Number(r.distanz_km) || 0),
        0
      );
      const aktuellesWochenvolumen = Math.round((sum28 / 4) * 10) / 10;

      const trainingstageProWoche = availableSlots.length;
      const leistungsprofil = computeAthleteLeistungsprofil(profile);

      // 1) Makro-Skelett laden (falls vorhanden) oder einmalig generieren
      let makroSkelett = Array.isArray(profile?.makro_skelett)
        ? profile.makro_skelett
        : null;
      let skeletonWasGenerated = false;
      if (!makroSkelett) {
        makroSkelett = generateMacroSkeleton({
          startDatum: formatDateISO(today),
          ziel_datum: profile.ziel_datum,
          hauptziel: profile.hauptziel || profile.ziel,
          fitnesslevel: profile.fitnesslevel,
          aktuellesWochenvolumen,
          trainingstageProWoche,
        });
        skeletonWasGenerated = true;
      }

      // 2) Makro-Skelett im Profil speichern (nur wenn neu erzeugt)
      if (skeletonWasGenerated) {
        await supabase
          .from("profiles")
          .update({ makro_skelett: makroSkelett })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) {
              console.error("Makro-Skelett update error:", error);
            }
          });
      }

      const todayIso = formatDateISO(today);
      const weekIndex = makroSkelett.findIndex(
        (w) => w.startDatum <= todayIso && w.endDatum >= todayIso
      );
      const weeksToPlan = [];
      if (weekIndex >= 0) weeksToPlan.push(makroSkelett[weekIndex]);
      if (weekIndex + 1 < makroSkelett.length)
        weeksToPlan.push(makroSkelett[weekIndex + 1]);

      const horizonDays = Number(body.days) > 0 ? Number(body.days) : 14;
      const horizonEnd = new Date(today);
      horizonEnd.setDate(horizonEnd.getDate() + (horizonDays - 1));

      const findSlotForDate = (date) => {
        const wd = dateToWochentag(date);
        return availableSlots.find((s) => s.wochentag === wd) || null;
      };

      // 3) Wochenvolumen auf Trainingstage verteilen (aktuelle + nächste Woche)
      const generated = [];
      for (const week of weeksToPlan) {
        const weekStart = new Date(week.startDatum);
        const weekEnd = new Date(week.endDatum);
        // Begrenzen auf 14-Tage-Horizont
        const start = weekStart < today ? today : weekStart;
        const end = weekEnd > horizonEnd ? horizonEnd : weekEnd;

        const isoDates = [];
        for (
          let d = new Date(start);
          d <= end;
          d.setDate(d.getDate() + 1)
        ) {
          const slot = findSlotForDate(d);
          if (!slot) continue;
          isoDates.push(formatDateISO(d));
        }
        if (isoDates.length === 0) continue;

        const entriesWeek = generateMicrocycleForDates({
          isoDates,
          weekContext: week,
          slots: availableSlots,
          leistungsprofil,
        });
        generated.push(...entriesWeek);
      }

      const startDate = formatDateISO(today);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + Math.max(0, horizonDays - 1));

      await supabase
        .from("training_plan")
        .delete()
        .eq("user_id", user.id)
        .gte("datum", startDate)
        .lte("datum", formatDateISO(endDate));

      if (generated.length === 0) {
        return jsonResponse(
          { error: "Keine Trainingszeitslots – bitte zuerst Zeiten hinterlegen" },
          400
        );
      }

      const entries = generated.map((entry) => ({
        user_id: user.id,
        ...entry,
      }));

      const { data, error } = await supabase
        .from("training_plan")
        .insert(entries)
        .select();

      if (error) throw error;
      return jsonResponse({ success: true, plan: data, makro_skelett: makroSkelett }, 201);
    }

    if (!plan || !Array.isArray(plan)) {
      return jsonResponse({ error: "Plan fehlt oder ist ungültig" }, 400);
    }

    const entries = plan.map((entry) => ({
      user_id: user.id,
      datum: entry.datum,
      trainingstyp: entry.trainingstyp,
      dauer_minuten: entry.dauer_minuten || null,
      distanz_km: entry.distanz_km || null,
      beschreibung: entry.beschreibung || null,
      uhrzeit_start: entry.uhrzeit_start || null,
      uhrzeit_ende: entry.uhrzeit_ende || null,
      status: entry.status || "geplant",
      erstellt_von_ai: entry.erstellt_von_ai || false,
      ist_spontan: entry.ist_spontan || false,
    }));

    const { data, error } = await supabase
      .from("training_plan")
      .insert(entries)
      .select();

    if (error) {
      console.error("Training plan create error:", error);
      return jsonResponse(
        { error: error.message || "Trainingsplan konnte nicht erstellt werden" },
        500
      );
    }

    return jsonResponse({ success: true, plan: data }, 201);
  } catch (error) {
    console.error("Training plan create API error:", error);
    return jsonResponse(
      { error: error.message || "Trainingsplan konnte nicht erstellt werden" },
      500
    );
  }
}

export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) return jsonResponse({ error: authError.message }, 401);
    if (!user) return jsonResponse({ error: "Nicht angemeldet" }, 401);

    const body = await request.json();
    const { id, datum, ...updates } = body;

    if (!id && !datum) {
      return jsonResponse({ error: "Plan-ID oder Datum fehlt" }, 400);
    }

    // Build the update query
    let updateQuery = supabase.from("training_plan").update(updates).eq("user_id", user.id);

    if (id) {
      updateQuery = updateQuery.eq("id", id);
    } else {
      updateQuery = updateQuery.eq("datum", datum);
    }

    // Execute the update
    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Training plan update error:", updateError);
      return jsonResponse(
        { error: updateError.message || "Trainingsplan konnte nicht aktualisiert werden" },
        500
      );
    }

    // Fetch the updated entry
    let selectQuery = supabase.from("training_plan").select("*").eq("user_id", user.id).limit(1);

    if (id) {
      selectQuery = selectQuery.eq("id", id);
    } else {
      selectQuery = selectQuery.eq("datum", updates.datum || datum);
    }

    const { data, error: selectError } = await selectQuery.single();

    if (selectError || !data) {
      console.error("Training plan fetch after update error:", selectError);
      // Return success even if we can't fetch (the update likely worked)
      return jsonResponse({ success: true, entry: null });
    }

    return jsonResponse({ success: true, entry: data });
  } catch (error) {
    console.error("Training plan update API error:", error);
    return jsonResponse(
      { error: error.message || "Trainingsplan konnte nicht aktualisiert werden" },
      500
    );
  }
}
