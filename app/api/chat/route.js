import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { buildContextPayload, buildSystemPrompt } from "@/lib/prompt";
import { getProfileForUser, getProfileWeatherContext } from "@/lib/profile-server";
import { getRecentRunsForContext } from "@/lib/runs-server";
import {
  getTrainingPlan,
  getTrainingSlots,
  dateToWochentag,
  formatDateISO,
} from "@/lib/training-server";
import {
  computeAthleteLeistungsprofil,
  generateMacroSkeleton,
  generateMicrocycleForDates,
  skelettIstGueltig,
} from "@/lib/training-engine";

const MODEL = "llama-3.3-70b-versatile";

// Globales App-Tageslimit als Sicherheitsnetz gegen Bots/Bugs/Überlastung
// Dieser Wert sollte je nach Groq-Tagesbudget angepasst werden
const GLOBAL_DAILY_LIMIT = 800;

function extractTextFromResponse(content) {
  const safeContent = typeof content === "string" ? content : String(content ?? "");

  try {
    const parsed = JSON.parse(safeContent);
    if (parsed?.text) return parsed.text;

    return (
      Object.values(parsed || {})
        .filter((value) => typeof value === "string")
        .join(" ")
        .trim() || safeContent
    );
  } catch {
    return (
      safeContent
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/\{[\s\S]*?\}/g, "")
        .trim() || safeContent
    );
  }
}

function slotMinuten(start, ende) {
  // Offenes Zeitfenster (ohne Start/Ende) → keine harte Begrenzung
  if (!start || !ende) return null;
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(ende).split(":").map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  return eh * 60 + em - (sh * 60 + sm);
}

async function regeneratePlan(userId, supabase, { simulatedTodayIso = null } = {}) {
  const [profile, slots] = await Promise.all([
    getProfileForUser(supabase, userId),
    getTrainingSlots(supabase, userId),
  ]);

  const availableSlots = (slots || []).filter((s) => {
    if (!s.verfuegbar) return false;
    const mins = slotMinuten(s.uhrzeit_start, s.uhrzeit_ende);
    return mins == null ? true : mins >= 45;
  });
  if (availableSlots.length === 0) {
    return { type: "no_slots" };
  }

  const today = (() => {
    if (simulatedTodayIso) {
      const d = new Date(simulatedTodayIso);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  // Aktuelles Wochenvolumen (Ø letzte 4 Wochen) aus DB (letzte 28 Tage / 4)
  const since = new Date(today);
  since.setDate(since.getDate() - 28);
  const { data: runs28, error: runsError } = await supabase
    .from("runs")
    .select("distanz_km, created_at, pace")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (runsError) throw runsError;

  const sum28 = (runs28 || []).reduce(
    (acc, r) => acc + (Number(r.distanz_km) || 0),
    0
  );
  let aktuellesWochenvolumen = Math.round((sum28 / 4) * 10) / 10;

  // Kaltstart-Fallback: Nutze Selbsteinschätzung aus Onboarding
  if (aktuellesWochenvolumen === 0) {
    const freq = profile.aktuelle_trainingsfrequenz;
    const dist = profile.aktuelle_distanz;
    
    // Schätze Wochenvolumen aus Onboarding-Angaben:
    const distMap = {
      'unter 3km': 2.5,
      '3-5km': 4,
      '5-10km': 7,
      'über 10km': 12
    };
    const freqMap = {
      'gar nicht': 0,
      '1-2x': 1.5,
      '3-4x': 3.5,
      '5x+': 5
    };
    
    const typDistanz = distMap[dist?.toLowerCase()] || 5;
    const typFreq = freqMap[freq?.toLowerCase()] || 2;
    aktuellesWochenvolumen = Math.round(typDistanz * typFreq * 10) / 10;
    
    // Absolutes Minimum: 10km für Einsteiger
    if (aktuellesWochenvolumen < 10) aktuellesWochenvolumen = 10;
  }

  const trainingstageProWoche = availableSlots.length;
  const leistungsprofil = computeAthleteLeistungsprofil(profile);

  // Makro-Skelett laden (falls vorhanden) oder einmalig generieren
  let makroSkelett = Array.isArray(profile?.makro_skelett)
    ? profile.makro_skelett
    : null;
  let skeletonWasGenerated = false;
  
  // Prüfen ob Skelett noch gültig ist
  if (!skelettIstGueltig(makroSkelett, profile)) {
    makroSkelett = generateMacroSkeleton({
      startDatum: formatDateISO(today),
      ziel_datum: profile.ziel_datum,
      hauptziel: profile.hauptziel || profile.ziel,
      fitnesslevel: profile.fitnesslevel,
      aktuellesWochenvolumen,
      trainingstageProWoche,
    });
    // Timestamp zum Skelett hinzufügen
    makroSkelett = {
      generiert_am: new Date().toISOString(),
      ziel: profile.hauptziel || profile.ziel,
      ziel_datum: profile.ziel_datum,
      wochen: makroSkelett,
    };
    skeletonWasGenerated = true;
  }

  if (skeletonWasGenerated) {
    await supabase
      .from("profiles")
      .update({ makro_skelett: makroSkelett })
      .eq("id", userId);
  }

  const todayIso = formatDateISO(today);
  const skelettWochen = Array.isArray(makroSkelett.wochen) ? makroSkelett.wochen : makroSkelett;
  const weekIndex = skelettWochen.findIndex(
    (w) => w.startDatum <= todayIso && w.endDatum >= todayIso
  );
  const weeksToPlan = [];
  if (weekIndex >= 0) weeksToPlan.push(skelettWochen[weekIndex]);
  if (weekIndex + 1 < skelettWochen.length)
    weeksToPlan.push(skelettWochen[weekIndex + 1]);

  const horizonDays = 14;
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + (horizonDays - 1));

  const findSlotForDate = (date) => {
    const wd = dateToWochentag(date);
    return availableSlots.find((s) => s.wochentag === wd) || null;
  };

  const generated = [];
  for (const week of weeksToPlan) {
    const weekStart = new Date(week.startDatum);
    const weekEnd = new Date(week.endDatum);
    const start = weekStart < today ? today : weekStart;
    const end = weekEnd > horizonEnd ? horizonEnd : weekEnd;

    const isoDates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
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

  const startIso = formatDateISO(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (horizonDays - 1));
  const endIso = formatDateISO(endDate);

  // Get completed dates to protect them
  const { data: completedDates } = await supabase
    .from("training_plan")
    .select("datum")
    .eq("user_id", userId)
    .eq("status", "completed");

  const protectedDates = new Set(
    completedDates?.map(r => r.datum) || []
  );

  // Delete only non-completed units
  await supabase
    .from("training_plan")
    .delete()
    .eq("user_id", userId)
    .gte("datum", startIso)
    .lte("datum", endIso)
    .neq("status", "completed");

  if (generated.length === 0) {
    return { type: "no_slots" };
  }

  // Filter out entries for protected dates
  const entries = generated
    .filter(entry => !protectedDates.has(entry.datum))
    .map((entry) => ({
      user_id: userId,
      ...entry,
    }));

  const { data, error } = await supabase
    .from("training_plan")
    .insert(entries)
    .select();
  if (error) throw error;

  return { type: "plan_replanned", data };
}

async function executeAction(action, data, userId, supabase, { simulatedTodayIso = null } = {}) {
  if (action === "update_single_day") {
    const updateResult = await supabase.from("training_plan").upsert(
      {
        user_id: userId,
        datum: data.datum,
        trainingstyp: data.trainingstyp,
        distanz_km: data.distanz_km,
        dauer_minuten: data.dauer_minuten,
        beschreibung: data.beschreibung || "",
        status: "geplant",
      },
      { onConflict: "user_id,datum" }
    ).select().single();
    
    // Fallback: If upsert select fails, use the provided data
    const unit = updateResult.data || data;
    
    return { type: "plan_day_updated", unit };
  }

  // update_slot: kompletter Slot-Replace (wie im Spec)
  if (action === "update_slot" || action === "update_slots") {
    const slots = action === "update_slot" ? data?.slots : data;
    await supabase.from("training_slots").delete().eq("user_id", userId);
    if (Array.isArray(slots) && slots.length > 0) {
      await supabase.from("training_slots").insert(
        slots.map((s) => ({
          user_id: userId,
          wochentag: s.wochentag,
          wochentag_name: s.wochentag_name,
          verfuegbar: true,
          uhrzeit_start: s.uhrzeit_start,
          uhrzeit_ende: s.uhrzeit_ende,
        }))
      );
    }
    const { data: replannedData } = await regeneratePlan(userId, supabase, { simulatedTodayIso });
    return { type: "slots_updated", units: replannedData };
  }

  if (action === "replan") {
    const result = await regeneratePlan(userId, supabase, { simulatedTodayIso });
    return result;
  }

  if (action === "update_profile") {
    await supabase.from("profiles").update(data).eq("id", userId);
    return { type: "profile_updated" };
  }

  if (action === "log_run") {
    await supabase.from("runs").insert({
      user_id: userId,
      distanz_km: data.distanz_km,
      pace: data.pace,
      herzfrequenz: data.herzfrequenz,
      befinden: data.befinden || 4,
      notizen: data.notizen || "Im Chat eingetragen",
      sport_art: data.sport_art || "laufen",
      created_at: new Date().toISOString(),
    });
    return { type: "run_logged" };
  }

  return { type: "unknown_action", action };
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const userId = user.id;

    // Load complete profile with all fields
    const { data: profil, error: profilError } = await supabase
      .from('profiles')
      .select(`
        vorname,
        alter_jahre,
        geschlecht,
        koerperfettanteil,
        fitnesslevel,
        hauptziel,
        ziel_datum,
        zielzeit,
        zielpace,
        zieldistanz,
        aktuelle_trainingsfrequenz,
        aktuelle_distanz,
        referenzzeit_5k,
        referenzzeit_10k,
        trainingstage,
        stadt,
        latitude,
        longitude,
        makro_skelett,
        onboarding_abgeschlossen,
        nachrichten_heute,
        nachrichten_reset_datum,
        nachrichten_limit
      `)
      .eq('id', userId)
      .single();

    // Check if onboarding is completed
    if (!profil?.onboarding_abgeschlossen) {
      return Response.json({
        reply: 'Bitte schließe zuerst das Onboarding ab.',
        action: null
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GROQ_API_KEY fehlt in .env.local" },
        { status: 500 }
      );
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Nachrichten fehlen" }, { status: 400 });
    }

    if (messages[0].role !== "user") {
      return Response.json(
        { error: "Erste Nachricht muss vom Nutzer sein" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return Response.json(
        { error: "Letzte Nachricht muss vom Nutzer sein" },
        { status: 400 }
      );
    }

    const heute = new Date().toISOString().split("T")[0];
    
    let profilNachrichten = {
      nachrichten_heute: profil?.nachrichten_heute || 0,
      nachrichten_reset_datum: profil?.nachrichten_reset_datum || heute,
      nachrichten_limit: profil?.nachrichten_limit || 10,
    };

    const letzterReset = profilNachrichten?.nachrichten_reset_datum;

    if (letzterReset !== heute) {
      const { error: resetError } = await supabase
        .from("profiles")
        .update({
          nachrichten_heute: 0,
          nachrichten_reset_datum: heute,
        })
        .eq("id", userId);

      if (resetError) {
        throw resetError;
      }

      profilNachrichten = {
        ...profilNachrichten,
        nachrichten_heute: 0,
        nachrichten_reset_datum: heute,
      };
    }

    const limit = profilNachrichten?.nachrichten_limit || 10;
    const genutzt = profilNachrichten?.nachrichten_heute || 0;

    if (genutzt >= limit) {
      return Response.json(
        {
          reply: `Du hast dein heutiges Limit von ${limit} Nachrichten erreicht. Dein Kontingent wird um Mitternacht zurückgesetzt. Bis morgen! 💪`,
          limitReached: true,
          resetTime: "Mitternacht",
          nachrichtenInfo: {
            nachrichten_heute: genutzt,
            nachrichten_limit: limit,
          },
        },
        { status: 200 }
      );
    }

    // Globales App-Tageslimit prüfen (Sicherheitsnetz gegen Bots/Bugs/Überlastung)
    const { data: globalUsage, error: globalUsageError } = await supabase.rpc(
      "increment_and_check_global_usage",
      {
        target_date: heute,
        limit_threshold: GLOBAL_DAILY_LIMIT,
      }
    );

    if (globalUsageError) {
      console.error("Global usage check error:", globalUsageError);
      // Bei Fehler im RPC-Call lassen wir die Anfrage durch (fail-safe)
    } else if (globalUsage?.exceeded) {
      return Response.json(
        {
          error: "Ascend ist heute außergewöhnlich gefragt. Bitte versuche es morgen wieder.",
          globalLimitReached: true,
        },
        { status: 429 }
      );
    }

    const simulatedTodayIso =
      process.env.NODE_ENV === "development"
        ? request.headers.get("x-simulated-date")
        : null;

    const [runs, trainingSlots] = await Promise.all([
      getRecentRunsForContext(supabase, userId),
      getTrainingSlots(supabase, userId).catch(() => []),
    ]);

    // TrainingPlan für Prompt-Abschnitt ggf. mit simuliertem Datum laden (nur Dev)
    let trainingPlan = [];
    if (simulatedTodayIso) {
      const startIso = simulatedTodayIso;
      const end = new Date(simulatedTodayIso);
      end.setDate(end.getDate() + 14);
      const endIso = end.toISOString().split("T")[0];
      const { data } = await supabase
        .from("training_plan")
        .select("*")
        .eq("user_id", userId)
        .gte("datum", startIso)
        .lte("datum", endIso)
        .order("datum", { ascending: true });
      trainingPlan = data || [];
    } else {
      trainingPlan = await getTrainingPlan(supabase, userId, 14).catch(() => []);
    }

    const weatherContext = profil
      ? await getProfileWeatherContext(profil)
      : null;

    const extraContextPayload = await buildContextPayload(userId, supabase, {
      simulatedTodayIso,
    }).catch(
      (e) => {
        console.error("Context payload error:", e);
        return "";
      }
    );

    const systemInstruction = buildSystemPrompt(
      runs,
      profil,
      weatherContext,
      trainingPlan,
      trainingSlots,
      extraContextPayload
    );

    const groqMessages = [
      { role: "system", content: systemInstruction },
      ...messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: groqMessages,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const result = completion;
    const aiResponse =
      result.choices[0]?.message?.content ||
      result.content?.[0]?.text ||
      "Keine Antwort";

    let responseText = extractTextFromResponse(aiResponse);
    let action = null;
    let actionData = null;
    let actionResult = null;

    try {
      const parsed = JSON.parse(aiResponse);
      responseText = parsed?.text || extractTextFromResponse(aiResponse);
      action = parsed?.action || null;
      actionData = parsed?.data || null;
    } catch {
      responseText = extractTextFromResponse(aiResponse);
      action = null;
      actionData = null;
    }

    if (action) {
      actionResult = await executeAction(
        action,
        actionData,
        userId,
        supabase,
        { simulatedTodayIso }
      );
    }

    const naechsteNachrichtenzahl = genutzt + 1;
    const { error: counterError } = await supabase
      .from("profiles")
      .update({
        nachrichten_heute: naechsteNachrichtenzahl,
      })
      .eq("id", userId);

    if (counterError) {
      throw counterError;
    }

    const planUpdated =
      actionResult?.type === "plan_day_updated" ||
      actionResult?.type === "plan_replanned" ||
      actionResult?.type === "slots_updated" ||
      actionResult?.type === "slot_updated";

    return Response.json({
      reply: responseText,
      action,
      planUpdated,
      actionExecuted: !!action,
      limitReached: naechsteNachrichtenzahl >= limit,
      resetTime: "Mitternacht",
      nachrichtenInfo: {
        nachrichten_heute: naechsteNachrichtenzahl,
        nachrichten_limit: limit,
      },
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: error.message || "Fehler bei der KI-Anfrage" },
      { status: 500 }
    );
  }
}
