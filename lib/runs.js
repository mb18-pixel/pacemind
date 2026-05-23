export function formatPace(paceMin, paceSec) {
  const sec = String(paceSec ?? 0).padStart(2, "0");
  return `${paceMin}:${sec} min/km`;
}

export function paceToString(paceMin, paceSec) {
  const sec = String(paceSec ?? 0).padStart(2, "0");
  return `${paceMin}:${sec}`;
}

export function parsePaceString(pace) {
  const [min, sec] = pace.split(":");
  return { paceMin: Number(min), paceSec: Number(sec) || 0 };
}

export function mapDbRunToApp(row) {
  const { paceMin, paceSec } = parsePaceString(row.pace);
  return {
    id: row.id,
    date: row.created_at,
    distanceKm: Number(row.distanz_km),
    paceMin,
    paceSec,
    heartRateAvg: row.herzfrequenz ?? null,
    heartRateMax: row.herzfrequenz_max ?? null,
    feeling: row.befinden,
    notes: row.notizen || "",
  };
}

export function formatRunForContext(run) {
  const date = new Date(run.date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const parts = [
    `Datum: ${date}`,
    `Distanz: ${run.distanceKm} km`,
    `Pace: ${formatPace(run.paceMin, run.paceSec)}`,
  ];
  if (run.heartRateAvg) parts.push(`Ø Herzfrequenz: ${run.heartRateAvg} bpm`);
  if (run.heartRateMax) parts.push(`Max. Herzfrequenz: ${run.heartRateMax} bpm`);
  parts.push(`Befinden: ${run.feeling}/5`);
  if (run.notes) parts.push(`Notizen: ${run.notes}`);
  return parts.join(", ");
}
