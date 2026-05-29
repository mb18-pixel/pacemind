import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getProfileForUser } from "@/lib/profile-server";
import { getRecentRunsForContext } from "@/lib/runs-server";
import {
  getTrainingSlots,
  dateToWochentag,
  formatDateISO,
} from "@/lib/training-server";
import { generateMacroSkeleton } from "@/lib/training-engine";
import { buildEinheitAnatomie, paceZonenFromReferenzzeit } from "@/lib/coach-knowledge";

export const dynamic = "force-dynamic";

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

    const startDate = getSimulatedToday(request) || new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + days);

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
      const [profile, slots, runs] = await Promise.all([
        getProfileForUser(supabase, user.id),
        getTrainingSlots(supabase, user.id),
        getRecentRunsForContext(supabase, user.id).catch(() => []),
      ]);

      const availableSlots = (slots || []).filter((s) => s.verfuegbar);
      if (availableSlots.length === 0) {
        return jsonResponse(
          { error: "Keine Trainingszeitslots – bitte zuerst Zeiten hinterlegen" },
          400
        );
      }

      // Aktuelles Wochenvolumen (Ø letzte 4 Wochen) aus DB (letzte 28 Tage / 4)
      const today = simulatedToday || new Date();
      today.setHours(0, 0, 0, 0);
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

      // Durchschnittspace (aus den letzten Runs im Kontext). Fallback über Fitnesslevel.
      const avgPaceSec = (() => {
        const valid = (runs || []).filter((r) => r?.paceMin != null);
        if (valid.length === 0) {
          const lvl = profile.fitnesslevel || "hobby";
          if (lvl === "einsteiger") return 7 * 60;
          if (lvl === "fortgeschritten") return 5 * 60;
          return 6 * 60;
        }
        let totalSec = 0;
        let totalKm = 0;
        for (const r of valid) {
          const secPerKm = Number(r.paceMin) * 60 + Number(r.paceSec || 0);
          const km = Number(r.distanceKm) || 0;
          if (!Number.isFinite(secPerKm) || !Number.isFinite(km) || km <= 0)
            continue;
          totalSec += secPerKm * km;
          totalKm += km;
        }
        if (totalKm <= 0) return 6 * 60;
        return totalSec / totalKm;
      })();

      const paceMinPerKm = avgPaceSec / 60;
      const paceString = (() => {
        const sec = Math.round(avgPaceSec);
        const m = Math.floor(sec / 60);
        const s = String(sec % 60).padStart(2, "0");
        return `${m}:${s}`;
      })();

      const trainingstageProWoche = availableSlots.length;

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

      const pickPreferredDate = (dates, preferredWeekdays) => {
        for (const wd of preferredWeekdays) {
          const d = dates.find((x) => dateToWochentag(new Date(x)) === wd);
          if (d) return d;
        }
        return dates[dates.length - 1] || null;
      };

      const assignTypesToDates = (week, isoDates) => {
        const phase = week.phase;
        const n = isoDates.length;
        const out = new Map();
        if (n === 0) return out;

        const longRunDate =
          week.trainingstypen?.includes("langlauf")
            ? pickPreferredDate(isoDates, [6, 5, 4]) // So, Sa, Fr
            : null;
        if (longRunDate) out.set(longRunDate, "langlauf");

        if (phase === "basis") {
          // 1x Strides/Fahrtspiel -> als "intervall" kodiert
          const candidates = isoDates.filter((d) => d !== longRunDate);
          const intervalDate = candidates.length
            ? pickPreferredDate(candidates, [1, 2, 3]) // Di/Mi/Do
            : null;
          if (intervalDate) out.set(intervalDate, "intervall");
          for (const d of isoDates) if (!out.has(d)) out.set(d, "locker");
          return out;
        }

        if (phase === "spezifisch") {
          const candidates = isoDates.filter((d) => d !== longRunDate);
          const intervalDate = candidates.length
            ? pickPreferredDate(candidates, [1, 2]) // Di/Mi
            : null;
          if (intervalDate) out.set(intervalDate, "intervall");
          const remaining = candidates.filter((d) => d !== intervalDate);
          const tempoDate = remaining.length
            ? pickPreferredDate(remaining, [3, 4]) // Do/Fr
            : null;
          if (tempoDate) out.set(tempoDate, "tempo");
          for (const d of isoDates) if (!out.has(d)) out.set(d, "locker");
          return out;
        }

        // tapering
        const candidates = isoDates.filter((d) => d !== longRunDate);
        const intervalDate = candidates.length
          ? pickPreferredDate(candidates, [1, 2]) // Di/Mi
          : null;
        if (intervalDate) out.set(intervalDate, "intervall");
        const remaining = candidates.filter((d) => d !== intervalDate);
        const tempoDate = remaining.length
          ? pickPreferredDate(remaining, [3, 4]) // Do/Fr
          : null;
        if (tempoDate) out.set(tempoDate, "tempo");
        for (const d of isoDates) if (!out.has(d)) out.set(d, "locker");
        return out;
      };

      const paceZonen = profile?.ref_5k_zeit
        ? paceZonenFromReferenzzeit({
            referenzDistanzKm: profile.ref_5k_distanz_km || 5,
            referenzZeit: profile.ref_5k_zeit,
          })
        : null;

      const buildBeschreibung = (trainingstyp, distanzKm, dauerMin) => {
        const zoneName =
          trainingstyp === "intervall"
            ? "Zone 4-5"
            : trainingstyp === "tempo"
            ? "Zone 3-4"
            : "Zone 2";
        const rpe =
          trainingstyp === "intervall"
            ? "8-9"
            : trainingstyp === "tempo"
            ? "6-7"
            : "3-4";
        const zielPace =
          trainingstyp === "intervall"
            ? paceZonen?.intervall_zone4_5?.ziel
            : trainingstyp === "tempo"
            ? paceZonen?.tempo_zone3_4?.min
            : paceZonen?.easy_zone2?.min || paceString;

        const anatomy = buildEinheitAnatomie({
          trainingstyp,
          hauptteilMinuten: Math.max(10, Math.round((dauerMin || 30) * 0.75)),
          zielPace,
          zielZoneName: zoneName,
          zielRpe: rpe,
          zweck:
            trainingstyp === "intervall"
              ? "VO₂max- und neuromuskulärer Reiz"
              : trainingstyp === "tempo"
              ? "Laktatschwelle / Renntempo-Ökonomie"
              : "Mitochondrien-Biogenese, aerobe Kapazität",
          koerperliche_anpassung:
            trainingstyp === "intervall"
              ? "Verbessert Sauerstoffaufnahme, Laufökonomie bei hoher Intensität"
              : trainingstyp === "tempo"
              ? "Erhöht die Schwellenleistung und die Fähigkeit, Tempo zu halten"
              : "Verbessert Fettverbrennung und Ausdauerbasis",
        });

        return [
          `Warm-up: ${anatomy.warmup}`,
          `Hauptteil: ${anatomy.hauptteil}`,
          `Cool-down: ${anatomy.cooldown}`,
          `Zweck: ${anatomy.zweck}`,
          `Anpassung: ${anatomy.koerperliche_anpassung}`,
        ].join("\n");
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

        const typeByDate = assignTypesToDates(week, isoDates);
        const hasLongRun = Array.from(typeByDate.values()).includes("langlauf");
        const longRunDist = hasLongRun ? Number(week.max_long_run_km) || 0 : 0;
        const weekVol = Number(week.wochenvolumen_km) || 0;
        const otherCount = isoDates.length - (hasLongRun ? 1 : 0);
        const remaining = Math.max(0, weekVol - longRunDist);
        const baseOther = otherCount > 0 ? remaining / otherCount : 0;

        // Distanz-Liste (gerundet, letzte Einheit fängt Rundungsdifferenz ab)
        let assignedSum = 0;
        const distances = new Map();
        for (let i = 0; i < isoDates.length; i++) {
          const dateIso = isoDates[i];
          const typ = typeByDate.get(dateIso) || "locker";
          let dist = 0;
          if (typ === "langlauf") dist = longRunDist;
          else dist = baseOther;
          dist = Math.round(dist * 10) / 10;
          distances.set(dateIso, dist);
          assignedSum += dist;
        }
        // Rundungsdifferenz auf letzte Einheit korrigieren (falls sinnvoll)
        const diff = Math.round((weekVol - assignedSum) * 10) / 10;
        if (isoDates.length > 0 && Math.abs(diff) >= 0.1) {
          const last = isoDates[isoDates.length - 1];
          distances.set(last, Math.max(0, Math.round((distances.get(last) + diff) * 10) / 10));
        }

        for (const dateIso of isoDates) {
          const d = new Date(dateIso);
          const slot = findSlotForDate(d);
          const typ = typeByDate.get(dateIso) || "locker";
          const distanz_km = distances.get(dateIso);
          const dauer_minuten =
            distanz_km && distanz_km > 0
              ? Math.max(10, Math.round(distanz_km * paceMinPerKm))
              : null;

          generated.push({
            datum: dateIso,
            trainingstyp: typ,
            dauer_minuten,
            distanz_km: distanz_km && distanz_km > 0 ? distanz_km : null,
            beschreibung:
              typ === "pause"
                ? "Regeneration / Pause"
                : buildBeschreibung(typ, distanz_km, dauer_minuten),
            uhrzeit_start: slot?.uhrzeit_start || null,
            uhrzeit_ende: slot?.uhrzeit_ende || null,
            status: "geplant",
            erstellt_von_ai: false, // deterministisch per Code
          });
        }
      }

      const startDate = formatDateISO(today);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 14);

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

    let query = supabase.from("training_plan").update(updates).eq("user_id", user.id);

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("datum", datum);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Training plan update error:", error);
      return jsonResponse(
        { error: error.message || "Trainingsplan konnte nicht aktualisiert werden" },
        500
      );
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
