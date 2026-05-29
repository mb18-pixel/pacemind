const WOCHENTAG_VOLL = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

function normalizeTrainingstyp(typ) {
  if (!typ) return "locker";
  const t = String(typ).toLowerCase();
  const map = {
    locker: "locker",
    tempo: "tempo",
    intervall: "intervall",
    langlauf: "langlauf",
    "langer lauf": "langlauf",
    langerlauf: "langlauf",
    pause: "pause",
    regeneration: "pause",
    ruhetag: "pause",
  };
  return map[t] || t;
}

function isTrainingDay(typ) {
  return normalizeTrainingstyp(typ) !== "pause";
}

async function upsertPlanDay(supabase, userId, entry) {
  const updates = {
    datum: entry.datum,
    trainingstyp: normalizeTrainingstyp(entry.trainingstyp),
    dauer_minuten: entry.dauer_minuten ?? null,
    distanz_km: entry.distanz_km ?? null,
    beschreibung: entry.beschreibung ?? null,
    status: entry.status || "geplant",
    erstellt_von_ai: true,
  };

  if (entry.id) {
    const { data: updated, error } = await supabase
      .from("training_plan")
      .update(updates)
      .eq("id", entry.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  if (!entry.datum) {
    throw new Error("datum fehlt in Plan-Update");
  }

  const { data: existing } = await supabase
    .from("training_plan")
    .select("id")
    .eq("user_id", userId)
    .eq("datum", entry.datum)
    .maybeSingle();

  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from("training_plan")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  }

  const { data: inserted, error } = await supabase
    .from("training_plan")
    .insert({ ...updates, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

export async function applySingleDayUpdate(supabase, userId, data) {
  const typ = normalizeTrainingstyp(data?.trainingstyp);

  const saved = await upsertPlanDay(supabase, userId, data);
  return saved;
}

export async function applyReplanChanges(supabase, userId, data) {
  const changes = Array.isArray(data?.changes) ? data.changes : [];
  if (changes.length === 0) {
    throw new Error("replan erfordert mindestens einen Eintrag in data.changes");
  }
  const saved = [];

  for (const change of changes) {
    const typ = normalizeTrainingstyp(change.trainingstyp);
    saved.push(await upsertPlanDay(supabase, userId, change));
  }

  return saved;
}

export async function executeCoachAction(supabase, userId, action, data) {
  switch (action) {
    case "update_profile": {
      const payload =
        typeof data === "object" && !Array.isArray(data) ? data : {};
      const { data: profileData, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
      return { type: "profile_updated", data: profileData };
    }

    case "update_slots": {
      await supabase.from("training_slots").delete().eq("user_id", userId);
      const rows = (Array.isArray(data) ? data : []).map((slot) => ({
        user_id: userId,
        wochentag: slot.wochentag,
        wochentag_name:
          slot.wochentag_name || WOCHENTAG_VOLL[slot.wochentag] || null,
        verfuegbar: slot.verfuegbar !== false,
        uhrzeit_start: slot.uhrzeit_start || null,
        uhrzeit_ende: slot.uhrzeit_ende || null,
      }));
      const { data: slotsData, error } = await supabase
        .from("training_slots")
        .insert(rows)
        .select();
      if (error) throw error;
      return { type: "slots_updated", data: slotsData };
    }

    case "update_slot": {
      const payload =
        typeof data === "object" && !Array.isArray(data) ? data : {};
      if (payload.wochentag === undefined || payload.wochentag === null) {
        throw new Error("update_slot: wochentag fehlt");
      }
      const wochentag = Number(payload.wochentag);
      const wochentag_name =
        payload.wochentag_name || WOCHENTAG_VOLL[wochentag] || null;

      const { data: slotData, error } = await supabase
        .from("training_slots")
        .upsert(
          {
            user_id: userId,
            wochentag,
            wochentag_name,
            verfuegbar: payload.verfuegbar !== false,
            uhrzeit_start: payload.uhrzeit_start || null,
            uhrzeit_ende: payload.uhrzeit_ende || null,
          },
          { onConflict: "user_id,wochentag" }
        )
        .select()
        .single();
      if (error) throw error;
      return { type: "slot_updated", data: slotData };
    }

    case "add_spontaneous": {
      const payload =
        typeof data === "object" && !Array.isArray(data) ? data : {};
      if (!payload.datum) throw new Error("add_spontaneous: datum fehlt");
      if (!payload.trainingstyp)
        throw new Error("add_spontaneous: trainingstyp fehlt");

      const { data: planData, error } = await supabase
        .from("training_plan")
        .upsert(
          {
            user_id: userId,
            datum: payload.datum,
            trainingstyp: normalizeTrainingstyp(payload.trainingstyp),
            dauer_minuten: payload.dauer_minuten ?? null,
            distanz_km: payload.distanz_km ?? null,
            beschreibung: payload.beschreibung ?? null,
            uhrzeit_start: payload.uhrzeit_start || null,
            uhrzeit_ende: payload.uhrzeit_ende || null,
            status: payload.status || "geplant",
            erstellt_von_ai: true,
            ist_spontan: true,
          },
          { onConflict: "user_id,datum" }
        )
        .select()
        .single();
      if (error) throw error;
      return { type: "plan_day_updated", data: planData };
    }

    case "update_single_day": {
      const saved = await applySingleDayUpdate(supabase, userId, data);
      return { type: "plan_day_updated", data: saved };
    }

    case "replan": {
      const saved = await applyReplanChanges(supabase, userId, data);
      return { type: "plan_replanned", data: saved };
    }

    case "update_plan": {
      const saved = await applySingleDayUpdate(
        supabase,
        userId,
        Array.isArray(data) ? data[0] : data
      );
      return { type: "plan_day_updated", data: saved };
    }

    case "generate_plan": {
      return { type: "plan_generation_requested", data };
    }

    default:
      return { type: "unknown_action", action };
  }
}

export function extractJsonFromReply(reply) {
  const trimmed = reply.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock[1].trim());
      } catch {
        return null;
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
