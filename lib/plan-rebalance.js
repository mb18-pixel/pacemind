import { dateToWochentag, formatDateISO } from "./training-server";

const HARD_TYPES = new Set(["intervall", "tempo"]);
const WOCHENTAG_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function normalizeTyp(typ) {
  const t = String(typ || "locker").toLowerCase();
  const map = {
    regeneration: "pause",
    ruhetag: "pause",
    pause: "pause",
    locker: "locker",
    tempo: "tempo",
    intervall: "intervall",
    langlauf: "langlauf",
  };
  return map[t] || t;
}

function isHard(typ) {
  return HARD_TYPES.has(normalizeTyp(typ));
}

function isLongRun(entry) {
  return (
    normalizeTyp(entry.trainingstyp) === "langlauf" ||
    Number(entry.distanz_km) > 12
  );
}

function getAvailableWeekdays(slots) {
  return new Set(
    (slots || []).filter((s) => s.verfuegbar).map((s) => s.wochentag)
  );
}

function parseDate(datum) {
  const d = new Date(datum);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(datum) {
  const d = parseDate(datum);
  const monday = new Date(d);
  monday.setDate(d.getDate() - dateToWochentag(d));
  return formatDateISO(monday);
}

function cloneEntry(entry) {
  return {
    ...entry,
    trainingstyp: normalizeTyp(entry.trainingstyp),
    status: entry.status || "geplant",
    erstellt_von_ai: true,
  };
}

export function mergeChangesIntoPlan(currentPlan, changes) {
  const byDate = new Map();
  for (const row of currentPlan || []) {
    byDate.set(row.datum, cloneEntry(row));
  }

  const list = Array.isArray(changes) ? changes : [];
  for (const change of list) {
    if (!change?.datum) continue;
    const existing = byDate.get(change.datum);
    byDate.set(change.datum, cloneEntry({
      ...existing,
      ...change,
      id: existing?.id,
      datum: change.datum,
    }));
  }

  return [...byDate.values()].sort((a, b) => a.datum.localeCompare(b.datum));
}

function weeklyKm(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e.status === "uebersprungen") continue;
    const km = Number(e.distanz_km) || 0;
    if (km <= 0) continue;
    const wk = weekKey(e.datum);
    map.set(wk, (map.get(wk) || 0) + km);
  }
  return map;
}

function applyTapering(entries, zielDatum) {
  if (!zielDatum) return entries;
  const goal = parseDate(zielDatum);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToGoal = Math.ceil((goal - today) / (24 * 60 * 60 * 1000));
  if (daysToGoal > 14 || daysToGoal < 0) return entries;

  return entries.map((e) => {
    const d = parseDate(e.datum);
    const daysUntil = Math.ceil((goal - d) / (24 * 60 * 60 * 1000));
    if (daysUntil > 14 || daysUntil < 0) return e;
    if (daysUntil <= 14 && daysUntil > 7) {
      const factor = 0.85;
      return {
        ...e,
        dauer_minuten: e.dauer_minuten
          ? Math.round(e.dauer_minuten * factor)
          : null,
        distanz_km: e.distanz_km
          ? Math.round(Number(e.distanz_km) * factor * 10) / 10
          : null,
        beschreibung:
          (e.beschreibung || "") + " (Tapering-Woche)",
      };
    }
    if (daysUntil <= 7) {
      return {
        ...e,
        trainingstyp: isHard(e.trainingstyp) ? "locker" : e.trainingstyp,
        dauer_minuten: e.dauer_minuten
          ? Math.max(20, Math.round(e.dauer_minuten * 0.6))
          : null,
        distanz_km: e.distanz_km
          ? Math.max(3, Math.round(Number(e.distanz_km) * 0.5 * 10) / 10)
          : null,
        beschreibung: "Tapering – leicht halten vor dem Ziel",
      };
    }
    return e;
  });
}

function fixConsecutiveHard(entries) {
  const sorted = [...entries].sort((a, b) => a.datum.localeCompare(b.datum));
  const result = sorted.map((e) => ({ ...e }));

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const cur = result[i];
    if (
      prev.status !== "uebersprungen" &&
      cur.status !== "uebersprungen" &&
      isHard(prev.trainingstyp) &&
      isHard(cur.trainingstyp)
    ) {
      result[i] = {
        ...cur,
        trainingstyp: "locker",
        beschreibung: "Angepasst: Regeneration nach intensiver Einheit",
        dauer_minuten: cur.dauer_minuten
          ? Math.min(cur.dauer_minuten, 40)
          : 35,
        distanz_km: cur.distanz_km
          ? Math.min(Number(cur.distanz_km), 6)
          : 5,
      };
    }
  }
  return result;
}

function fixAfterLongRun(entries) {
  const sorted = [...entries].sort((a, b) => a.datum.localeCompare(b.datum));
  const result = sorted.map((e) => ({ ...e }));

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const cur = result[i];
    if (
      prev.status !== "uebersprungen" &&
      cur.status !== "uebersprungen" &&
      isLongRun(prev) &&
      !["pause", "locker"].includes(normalizeTyp(cur.trainingstyp))
    ) {
      result[i] = {
        ...cur,
        trainingstyp: "pause",
        dauer_minuten: 30,
        distanz_km: 4,
        beschreibung: "Regeneration nach langem Lauf",
      };
    }
  }
  return result;
}

function capWeeklyVolumeIncrease(entries) {
  const sorted = [...entries].sort((a, b) => a.datum.localeCompare(b.datum));
  const weeks = [...new Set(sorted.map((e) => weekKey(e.datum)))].sort();
  const vol = weeklyKm(sorted);
  let prevWeekKm = null;
  const result = sorted.map((e) => ({ ...e }));

  for (const wk of weeks) {
    const km = vol.get(wk) || 0;
    if (prevWeekKm !== null && km > prevWeekKm * 1.1) {
      const factor = (prevWeekKm * 1.1) / km;
      for (let i = 0; i < result.length; i++) {
        if (weekKey(result[i].datum) !== wk) continue;
        if (result[i].status === "uebersprungen") continue;
        if (!result[i].distanz_km) continue;
        result[i] = {
          ...result[i],
          distanz_km:
            Math.round(Number(result[i].distanz_km) * factor * 10) / 10,
          dauer_minuten: result[i].dauer_minuten
            ? Math.round(result[i].dauer_minuten * factor)
            : null,
        };
      }
    }
    prevWeekKm = weeklyKm(result).get(wk) || km;
  }
  return result;
}

function ensureSlotDays(entries, availableDays) {
  return entries.map((e) => {
    const wd = dateToWochentag(parseDate(e.datum));
    if (e.status === "uebersprungen") return e;
    if (!availableDays.has(wd) && e.trainingstyp !== "pause") {
      return {
        ...e,
        status: "uebersprungen",
        beschreibung:
          (e.beschreibung || "") + " – kein Zeitslot an diesem Tag",
      };
    }
    return e;
  });
}

function redistributeSkippedKm(entries, availableDays) {
  const sorted = [...entries].sort((a, b) => a.datum.localeCompare(b.datum));
  const thisWeek = weekKey(formatDateISO(new Date()));
  const weekEntries = sorted.filter((e) => weekKey(e.datum) === thisWeek);
  let lostKm = 0;
  const active = [];

  for (const e of weekEntries) {
    if (e.status === "uebersprungen") {
      lostKm += Number(e.distanz_km) || 0;
    } else if (
      availableDays.has(dateToWochentag(parseDate(e.datum))) &&
      normalizeTyp(e.trainingstyp) !== "pause"
    ) {
      active.push(e.datum);
    }
  }

  if (lostKm <= 0 || active.length === 0) return sorted;

  const addPerDay = lostKm / active.length;
  const byDate = new Map(sorted.map((e) => [e.datum, { ...e }]));

  for (const datum of active) {
    const e = byDate.get(datum);
    if (!e?.distanz_km) continue;
    byDate.set(datum, {
      ...e,
      distanz_km:
        Math.round((Number(e.distanz_km) + addPerDay) * 10) / 10,
      beschreibung:
        (e.beschreibung || "") +
        " – km leicht erhöht wegen ausgefallener Einheit",
    });
  }

  return [...byDate.values()].sort((a, b) => a.datum.localeCompare(b.datum));
}

export function rebalancePlan(entries, { slots = [], profile = null } = {}) {
  const availableDays = getAvailableWeekdays(slots);
  let plan = entries.map(cloneEntry);

  plan = ensureSlotDays(plan, availableDays);
  plan = fixConsecutiveHard(plan);
  plan = fixAfterLongRun(plan);
  plan = applyTapering(plan, profile?.ziel_datum);
  plan = capWeeklyVolumeIncrease(plan);
  plan = redistributeSkippedKm(plan, availableDays);
  plan = fixConsecutiveHard(plan);

  return plan.sort((a, b) => a.datum.localeCompare(b.datum));
}

export function summarizePlanDiff(before, after) {
  const beforeMap = new Map((before || []).map((e) => [e.datum, e]));
  const lines = [];

  for (const entry of after || []) {
    const prev = beforeMap.get(entry.datum);
    if (!prev) {
      lines.push(
        `${entry.datum}: neu – ${entry.trainingstyp} (${entry.dauer_minuten || "?"} min)`
      );
      continue;
    }
    if (prev.trainingstyp !== entry.trainingstyp) {
      lines.push(
        `${entry.datum}: ${prev.trainingstyp} → ${entry.trainingstyp}`
      );
    } else if (prev.status !== entry.status) {
      lines.push(`${entry.datum}: Status ${prev.status} → ${entry.status}`);
    } else if (prev.dauer_minuten !== entry.dauer_minuten) {
      lines.push(
        `${entry.datum}: ${entry.trainingstyp} – Dauer auf ${entry.dauer_minuten} min angepasst`
      );
    }
  }

  return lines;
}
