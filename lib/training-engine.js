/**
 * PaceMind Training Engine (mathematisches Backend)
 * -------------------------------------------------
 * Berechnet deterministisch (ohne KI) einen Makro-Trainingsplan als Wochen-Skelett.
 *
 * Output: Array von Wochen-Objekten (siehe Spezifikation im Issue/Prompt).
 */

import { formatDateISO } from "./training-server";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function normalizeZiel(ziel) {
  if (!ziel) return "gesund";
  const z = String(ziel).toLowerCase().trim();
  const map = {
    "5k": "5k",
    "5 km": "5k",
    "5km": "5k",
    "10k": "10k",
    "10 km": "10k",
    "10km": "10k",
    halbmarathon: "halbmarathon",
    hm: "halbmarathon",
    marathon: "marathon",
    m: "marathon",
  };
  return map[z] || z;
}

function normalizeFitnesslevel(level) {
  if (!level) return "hobby";
  const l = String(level).toLowerCase().trim();
  if (l.startsWith("ein")) return "einsteiger";
  if (l.startsWith("fort")) return "fortgeschritten";
  return "hobby";
}

function getDefaultStartVolumeKm(fitnesslevel) {
  // Startvolumen (Basis pro Fitnesslevel) – sinnvolle Midpoints der Range.
  switch (fitnesslevel) {
    case "einsteiger":
      return 18;
    case "fortgeschritten":
      return 48;
    default:
      return 30;
  }
}

function getMaxGoalVolumeKm(fitnesslevel) {
  switch (fitnesslevel) {
    case "einsteiger":
      return 35;
    case "fortgeschritten":
      return 100;
    default:
      return 60;
  }
}

function getLongRunMinKm(fitnesslevel) {
  switch (fitnesslevel) {
    case "einsteiger":
      return 6;
    case "fortgeschritten":
      return 10;
    default:
      return 8;
  }
}

function computeTotalWeeks(today, goalDate) {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const g = new Date(goalDate);
  g.setHours(0, 0, 0, 0);
  const diffDays = Math.max(0, Math.ceil((g - t) / MS_PER_DAY));
  return Math.max(1, Math.ceil(diffDays / 7));
}

function computePhaseWeeks(totalWeeks, ziel) {
  const z = normalizeZiel(ziel);
  const isLong = z === "halbmarathon" || z === "marathon";
  const basePct = isLong ? 0.5 : 0.4;
  const specPct = isLong ? 0.35 : 0.45;
  const taperPct = 0.15;

  // Tapering: mindestens 2, maximal 3 Wochen (wenn möglich).
  const rawTaper = Math.round(totalWeeks * taperPct);
  const taperWeeks = clamp(rawTaper, 2, 3);

  // Wenn Plan sehr kurz ist, taper nicht erzwingen.
  const taperFinal = totalWeeks <= 3 ? Math.max(1, Math.round(totalWeeks * taperPct)) : taperWeeks;
  let baseWeeks = Math.round(totalWeeks * basePct);
  let specificWeeks = totalWeeks - taperFinal - baseWeeks;

  // Korrigieren falls Rundungen überziehen.
  if (specificWeeks < 0) {
    baseWeeks = Math.max(0, baseWeeks + specificWeeks);
    specificWeeks = 0;
  }
  // Mindestens 1 Basis-Woche falls genug Zeit vorhanden.
  if (totalWeeks >= 4 && baseWeeks === 0) {
    baseWeeks = 1;
    specificWeeks = Math.max(0, totalWeeks - taperFinal - baseWeeks);
  }

  return { baseWeeks, specificWeeks, taperWeeks: taperFinal };
}

function getPhaseForWeekIndex(weekNumber1Based, phaseWeeks) {
  if (weekNumber1Based <= phaseWeeks.baseWeeks) return "basis";
  if (
    weekNumber1Based <=
    phaseWeeks.baseWeeks + phaseWeeks.specificWeeks
  )
    return "spezifisch";
  return "tapering";
}

function getMesoForWeekIndex(weekNumber1Based) {
  const idx = (weekNumber1Based - 1) % 4; // 0..3
  if (idx === 3) return { mesozyklus: "deload", deload: true };
  return { mesozyklus: "aufbau", deload: false };
}

function buildTrainingTypesForWeek({
  phase,
  trainingstageProWoche,
  isLastWeekBeforeRace,
}) {
  const n = Math.max(0, Math.floor(trainingstageProWoche || 0));
  if (n === 0) return [];

  const types = [];
  const pushMany = (typ, count) => {
    for (let i = 0; i < count; i++) types.push(typ);
  };

  if (phase === "basis") {
    // 1x Lang, 1x (Strides/Fahrtspiel) -> als "intervall" kodiert, Rest locker.
    if (n === 1) return ["locker"];
    if (n === 2) return ["locker", "langlauf"];
    pushMany("locker", n - 2);
    types.push("intervall");
    types.push("langlauf");
    return types;
  }

  if (phase === "spezifisch") {
    // 1x Lang, 1x Intervall, 1x Tempo, Rest locker.
    if (n === 1) return ["locker"];
    if (n === 2) return ["intervall", "locker"];
    if (n === 3) return ["intervall", "tempo", "langlauf"];
    pushMany("locker", n - 3);
    types.push("tempo");
    types.push("intervall");
    types.push("langlauf");
    return types;
  }

  // Tapering: Intensität bleibt, Volumen sinkt. Kein langer Lauf in letzter Woche.
  if (n === 1) return ["locker"];
  if (n === 2) return ["tempo", "locker"];

  // n >= 3
  pushMany("locker", n - 3);
  types.push("tempo");
  types.push("intervall");
  if (!isLastWeekBeforeRace) types.push("langlauf");
  else types.push("locker");
  return types;
}

/**
 * generateMacroSkeleton(profile)
 *
 * Erwartete Profile-Felder (Fallbacks werden genutzt):
 * - ziel_datum / zielDatum
 * - hauptziel / ziel
 * - fitnesslevel
 * - aktuellesWochenvolumen (km) – optional
 * - trainingstageProWoche / trainingstage (Slots)
 */
export function generateMacroSkeleton(profile = {}) {
  const today =
    profile.startDatum || profile.start_datum
      ? new Date(profile.startDatum || profile.start_datum)
      : new Date();
  today.setHours(0, 0, 0, 0);

  const goalRaw = profile.ziel_datum || profile.zielDatum || profile.zieldatum;
  if (!goalRaw) {
    throw new Error("generateMacroSkeleton: ziel_datum fehlt im Profil");
  }
  const goalDate = new Date(goalRaw);
  goalDate.setHours(0, 0, 0, 0);

  const ziel = normalizeZiel(profile.hauptziel || profile.ziel);
  const fitnesslevel = normalizeFitnesslevel(profile.fitnesslevel);

  const totalWeeks = computeTotalWeeks(today, goalDate);
  const phaseWeeks = computePhaseWeeks(totalWeeks, ziel);

  const maxGoalVolume = getMaxGoalVolumeKm(fitnesslevel);
  const startVolCandidate = Number(profile.aktuellesWochenvolumen);
  const startVolume = Number.isFinite(startVolCandidate) && startVolCandidate > 0
    ? startVolCandidate
    : getDefaultStartVolumeKm(fitnesslevel);

  const trainingstageProWoche =
    Number(profile.trainingstageProWoche ?? profile.trainingstage) || 0;

  const skeleton = [];
  let prevWeekVol = clamp(startVolume, 5, maxGoalVolume);

  for (let w = 1; w <= totalWeeks; w++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (w - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const phase = getPhaseForWeekIndex(w, phaseWeeks);
    const { mesozyklus, deload } = getMesoForWeekIndex(w);
    const isLastWeekBeforeRace = w === totalWeeks;

    let weekVol = prevWeekVol;

    if (w === 1) {
      weekVol = prevWeekVol;
    } else if (phase === "tapering") {
      // Volumen -20% pro Woche im Tapering
      weekVol = prevWeekVol * 0.8;
    } else if (deload) {
      // Deload: -30% gegenüber Vorwoche (bzw. gegenüber Woche 3 implizit via Vorwoche).
      weekVol = prevWeekVol * 0.7;
    } else {
      // Aufbau: 8-10%, aber max 10% pro Woche (ACWR)
      weekVol = prevWeekVol * 1.09;
      weekVol = Math.min(weekVol, prevWeekVol * 1.1);
    }

    weekVol = clamp(weekVol, 5, maxGoalVolume);

    const longRunMin = getLongRunMinKm(fitnesslevel);
    const longRunMaxByVolume = weekVol * 0.33;
    const longRunTarget = weekVol * 0.3;
    const max_long_run_km = round1(
      clamp(longRunTarget, longRunMin, longRunMaxByVolume)
    );

    const trainingstypen = buildTrainingTypesForWeek({
      phase,
      trainingstageProWoche,
      isLastWeekBeforeRace,
    });

    skeleton.push({
      woche: w,
      startDatum: formatDateISO(weekStart),
      endDatum: formatDateISO(weekEnd),
      phase,
      mesozyklus,
      wochenvolumen_km: round1(weekVol),
      intensitaetsverteilung: {
        zone1_2_prozent: 80,
        zone3_5_prozent: 20,
      },
      max_long_run_km,
      trainingstypen,
      deload,
    });

    prevWeekVol = weekVol;
  }

  return skeleton;
}
