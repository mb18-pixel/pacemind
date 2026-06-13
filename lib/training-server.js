import { formatDatumDe } from "./date-context";

const WOCHENTAG_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TRAININGSTYP_LABELS = {
  locker: "Lockerer Lauf",
  tempo: "Tempo",
  intervall: "Intervall",
  langlauf: "Langlauf",
  pause: "Pause / Regeneration",
};

export function dateToWochentag(date) {
  // JS: 0=So ... 6=Sa → DB: 0=Mo ... 6=So
  return (date.getDay() + 6) % 7;
}

export function formatDateISO(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export async function getTrainingPlan(supabase, userId, days = 14) {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { data, error } = await supabase
    .from("training_plan")
    .select("*")
    .eq("user_id", userId)
    .gte("datum", formatDateISO(startDate))
    .lte("datum", formatDateISO(endDate))
    .order("datum", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getTrainingSlots(supabase, userId) {
  const { data, error } = await supabase
    .from("training_slots")
    .select("*")
    .eq("user_id", userId)
    .order("wochentag", { ascending: true });

  if (error) throw error;
  return data || [];
}

const WOCHENTAG_VOLL = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

function formatSlotTime(slot) {
  if (slot.uhrzeit_start && slot.uhrzeit_ende) {
    const start = String(slot.uhrzeit_start).slice(0, 5);
    const end = String(slot.uhrzeit_ende).slice(0, 5);
    return `${start}–${end} Uhr`;
  }
  return "Zeitfenster offen";
}

export function formatSlotsForPrompt(slots) {
  const all = slots?.length
    ? slots
    : WOCHENTAG_VOLL.map((_, i) => ({
        wochentag: i,
        verfuegbar: false,
      }));

  const available = [];
  const unavailable = [];

  for (let i = 0; i < 7; i++) {
    const slot = all.find((s) => s.wochentag === i);
    const name = WOCHENTAG_VOLL[i];
    if (slot?.verfuegbar) {
      available.push(`${name} ${formatSlotTime(slot)}`);
    } else {
      unavailable.push(name);
    }
  }

  if (available.length === 0) {
    return "Keine Trainingszeiten hinterlegt. Bitte Nutzer an Onboarding/Kalender verweisen.";
  }

  const availLine =
    available.length > 0
      ? `Deine Trainingstage: ${available.join(", ")}.`
      : "";
  const unavailLine =
    unavailable.length > 0
      ? `${unavailable.join(", ")}: keine Zeit.`
      : "";

  return `${availLine}\n${unavailLine}`.trim();
}

function formatPlanEntryLine(entry) {
  const typ = TRAININGSTYP_LABELS[entry.trainingstyp] || entry.trainingstyp;
  const parts = [entry.ist_spontan ? "⚡" : null, typ].filter(Boolean);
  if (entry.uhrzeit_start) {
    const start = String(entry.uhrzeit_start).slice(0, 5);
    const end = entry.uhrzeit_ende ? String(entry.uhrzeit_ende).slice(0, 5) : "";
    parts.push(`${start}${end ? `–${end}` : ""} Uhr`);
  }
  if (entry.distanz_km) parts.push(`${entry.distanz_km} km`);
  if (entry.dauer_minuten) parts.push(`${entry.dauer_minuten} min`);
  if (entry.beschreibung) parts.push(entry.beschreibung);
  if (entry.status && entry.status !== "geplant") {
    parts.push(`[${entry.status}]`);
  }
  return parts.join(", ");
}

export function formatPlanForPrompt(plan) {
  const byDate = new Map((plan || []).map((e) => [e.datum, e]));
  const lines = [];

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    const { short, iso } = formatDatumDe(d);
    const entry = byDate.get(iso);

    if (entry) {
      lines.push(`${short}: ${formatPlanEntryLine(entry)} (id: ${entry.id || "neu"})`);
    } else {
      lines.push(`${short}: — kein Training geplant`);
    }
  }

  return lines.join("\n");
}

export function computeWeeklyVolumeFromRuns(runs) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dateToWochentag(now));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  let thisWeekKm = 0;
  let last7DaysKm = 0;
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  for (const run of runs || []) {
    const runDate = new Date(run.date);
    const km = Number(run.distanceKm) || 0;
    if (runDate >= sevenDaysAgo) last7DaysKm += km;
    if (runDate >= weekStart && runDate <= weekEnd) thisWeekKm += km;
  }

  return {
    thisWeekKm: Math.round(thisWeekKm * 10) / 10,
    last7DaysKm: Math.round(last7DaysKm * 10) / 10,
  };
}

export function computeWeeklyVolumeFromPlan(plan) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dateToWochentag(now));

  let km = 0;
  for (const e of plan || []) {
    const d = new Date(e.datum);
    if (d < weekStart) continue;
    if (e.status === "uebersprungen") continue;
    km += Number(e.distanz_km) || 0;
  }
  return Math.round(km * 10) / 10;
}

export function getDaysUntilGoal(zielDatum) {
  if (!zielDatum) return null;
  const goal = new Date(zielDatum);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  goal.setHours(0, 0, 0, 0);
  return Math.ceil((goal - today) / (24 * 60 * 60 * 1000));
}

export function isSlotDay(slots, datumIso) {
  const jsDay = new Date(datumIso).getDay();
  const dbDay = (jsDay + 6) % 7;
  const trainingstage = (slots || []).filter(s => s.verfuegbar).map(s => s.wochentag);
  console.log('Datum:', datumIso, 'jsDay:', jsDay, 'dbDay:', dbDay, 'Slots:', trainingstage);
  const wd = dateToWochentag(new Date(datumIso));
  return (slots || []).some((s) => s.wochentag === wd && s.verfuegbar);
}
