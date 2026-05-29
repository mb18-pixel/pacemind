import { dateToWochentag, formatDateISO } from "./training-server";

const HARD_TYPES = ["intervall", "tempo"];

function getAvailableWeekdays(slots) {
  return new Set(
    (slots || []).filter((s) => s.verfuegbar).map((s) => s.wochentag)
  );
}

function isHard(type) {
  return HARD_TYPES.includes(type);
}

function baseSession(fitnesslevel, ziel) {
  if (fitnesslevel === "einsteiger") {
    return { dauer: 30, distanz: 4 };
  }
  if (ziel === "marathon" || ziel === "halbmarathon") {
    return { dauer: 50, distanz: 8 };
  }
  if (fitnesslevel === "fortgeschritten") {
    return { dauer: 45, distanz: 7 };
  }
  return { dauer: 40, distanz: 6 };
}

function buildSessionType(dayIndex, weekIndex, availableCount, lastWasHard, lastWasLong) {
  const isWeekend = dayIndex === 5 || dayIndex === 6;

  if (lastWasLong) return "pause";
  if (lastWasHard) return "locker";

  if (isWeekend && availableCount >= 3 && weekIndex % 2 === 0) {
    return "langlauf";
  }

  const rotation = ["locker", "tempo", "locker", "intervall"];
  const pick = rotation[(weekIndex + dayIndex) % rotation.length];
  if (isHard(pick) && lastWasHard) return "locker";
  return pick;
}

const BESCHREIBUNGEN = {
  locker: "Lockerer Dauerlauf in Zone 2",
  tempo: "Tempolauf – komfortabel hart",
  intervall: "Intervalltraining mit Erholungsläufen",
  langlauf: "Langer Lauf – gleichmäßiges Tempo",
  pause: "Regeneration / Pause",
};

export function generateIntelligentPlan({
  slots = [],
  fitnesslevel = "hobby",
  ziel = "gesund",
  days = 14,
  recentRuns = [],
}) {
  const availableDays = getAvailableWeekdays(slots);
  if (availableDays.size === 0) return [];

  const base = baseSession(fitnesslevel, ziel);
  const plan = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  let lastWasHard = false;
  let lastWasLong = false;
  let sessionsThisWeek = 0;
  const maxPerWeek = Math.min(availableDays.size, 5);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const wochentag = dateToWochentag(date);

    if (i > 0 && dateToWochentag(date) === 0) {
      sessionsThisWeek = 0;
    }

    if (!availableDays.has(wochentag)) continue;
    if (sessionsThisWeek >= maxPerWeek) continue;

    const weekIndex = Math.floor(i / 7);
    const trainingstyp = buildSessionType(
      wochentag,
      weekIndex,
      availableDays.size,
      lastWasHard,
      lastWasLong
    );

    let dauer = base.dauer;
    let distanz = base.distanz;

    if (trainingstyp === "langlauf") {
      dauer = Math.round(base.dauer * 1.4);
      distanz = Math.round(base.distanz * 1.5 * 10) / 10;
    } else if (trainingstyp === "intervall") {
      dauer = Math.round(base.dauer * 0.85);
      distanz = Math.round(base.distanz * 0.9 * 10) / 10;
    } else if (trainingstyp === "pause") {
      dauer = 0;
      distanz = 0;
    } else if (trainingstyp === "tempo") {
      dauer = Math.round(base.dauer * 0.9);
    }

    if (recentRuns.length >= 3 && i < 3 && trainingstyp !== "pause") {
      // leichte Reduktion nach intensiver Phase
    }

    plan.push({
      datum: formatDateISO(date),
      trainingstyp,
      dauer_minuten: trainingstyp === "pause" ? null : dauer,
      distanz_km: trainingstyp === "pause" ? null : distanz,
      beschreibung: BESCHREIBUNGEN[trainingstyp],
      status: "geplant",
      erstellt_von_ai: true,
    });

    lastWasHard = isHard(trainingstyp);
    lastWasLong = trainingstyp === "langlauf";
    sessionsThisWeek++;
  }

  return plan;
}
