import { formatDateISO } from "./training-server";

const WOCHENTAG_VOLL = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

function addDays(base, days) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDatumDe(date) {
  const weekday = WOCHENTAG_VOLL[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return {
    weekday,
    short: `${weekday} ${day}.${month}.`,
    long: `${weekday}, ${day}.${month}.${year}`,
    iso: formatDateISO(date),
  };
}

export function buildDateReference(now = new Date()) {
  const heute = new Date(now);
  heute.setHours(0, 0, 0, 0);

  const morgen = addDays(heute, 1);
  const uebermorgen = addDays(heute, 2);

  const heuteFmt = formatDatumDe(heute);
  const morgenFmt = formatDatumDe(morgen);
  const uebermorgenFmt = formatDatumDe(uebermorgen);

  const uhrzeit = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const relative = [];
  for (let offset = 0; offset <= 13; offset++) {
    const d = addDays(heute, offset);
    const f = formatDatumDe(d);
    let label;
    if (offset === 0) label = "heute";
    else if (offset === 1) label = "morgen";
    else if (offset === 2) label = "übermorgen";
    else label = `in ${offset} Tagen`;
    relative.push(
      `- "${label}" = ${f.iso} (${f.short})`
    );
  }

  return {
    heute: heuteFmt,
    morgen: morgenFmt,
    uebermorgen: uebermorgenFmt,
    uhrzeit,
    relativeBlock: relative.join("\n"),
    promptBlock: `## Datum & Zeit (VERBINDLICH – immer diese Zuordnung nutzen)

Heutiges Datum: ${heuteFmt.long} (${heuteFmt.iso})
Morgen: ${morgenFmt.long} (${morgenFmt.iso})
Übermorgen: ${uebermorgenFmt.long} (${uebermorgenFmt.iso})
Aktuelle Uhrzeit: ${uhrzeit} Uhr

Relative Begriffe:
${relative.join("\n")}`,
  };
}
