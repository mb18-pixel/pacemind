import {
  coachKnowledge,
  berechneMaxHF,
  herzfrequenzZonen,
  paceZonenFromReferenzzeit,
  buildEinheitAnatomie,
} from "./coach-knowledge";
import { buildDateReference } from "./date-context";
import { formatRunForContext } from "./runs";
import { formatWeatherForPrompt } from "./weather";
import {
  computeWeeklyVolumeFromPlan,
  computeWeeklyVolumeFromRuns,
  formatPlanForPrompt,
  formatSlotsForPrompt,
  getDaysUntilGoal,
} from "./training-server";
import { getExtendedWeatherContext } from "./weather";
import { generateMacroSkeleton } from "./training-engine";

const FITNESS_LABELS = {
  einsteiger: "Einsteiger – läuft weniger als 6 Monate",
  hobby: "Hobby – regelmäßig seit über 6 Monaten",
  fortgeschritten: "Fortgeschritten – Wettkämpfe oder strukturiertes Training",
};

const ZIEL_LABELS = {
  "5k": "5K verbessern",
  "10k": "10K laufen oder verbessern",
  halbmarathon: "Halbmarathon",
  marathon: "Marathon",
  abnehmen: "Abnehmen durch Laufen",
  gesund: "Gesund und fit bleiben",
};

const GESCHLECHT_LABELS = {
  maennlich: "Männlich",
  weiblich: "Weiblich",
  divers: "Divers",
};

function formatProfileSection(profile) {
  if (!profile?.vorname) return "Kein Nutzerprofil hinterlegt.";

  const daysUntilGoal = getDaysUntilGoal(profile.ziel_datum);

  const lines = [
    `Vorname: ${profile.vorname}`,
    profile.geschlecht
      ? `Geschlecht: ${GESCHLECHT_LABELS[profile.geschlecht] || profile.geschlecht}`
      : null,
    profile.alter_jahre ? `Alter: ${profile.alter_jahre} Jahre` : null,
    profile.gewicht_kg ? `Gewicht: ${profile.gewicht_kg} kg` : null,
    profile.koerperfettanteil
      ? `Körperfettanteil ca.: ${profile.koerperfettanteil} %`
      : null,
    profile.stadt
      ? `Standort: ${profile.stadt}${profile.land ? `, ${profile.land}` : ""}`
      : null,
    profile.fitnesslevel
      ? `Fitnesslevel: ${FITNESS_LABELS[profile.fitnesslevel] || profile.fitnesslevel}`
      : null,
    profile.ziel
      ? `Ziel: ${ZIEL_LABELS[profile.ziel] || profile.ziel}`
      : null,
    profile.ziel_datum ? `Zieldatum: ${profile.ziel_datum}` : null,
    daysUntilGoal !== null
      ? `Verbleibende Tage bis Ziel: ${daysUntilGoal}`
      : null,
    profile.trainingstage
      ? `Trainingstage pro Woche (Slots): ${profile.trainingstage}`
      : null,
  ].filter(Boolean);

  return lines.join("\n");
}

export function buildSystemPrompt(
  runs = [],
  profile = null,
  weatherContext = null,
  trainingPlan = [],
  trainingSlots = [],
  extraContextPayload = ""
) {
  const dateRef = buildDateReference();
  const vorname = profile?.vorname || "Athlet";
  const volRuns = computeWeeklyVolumeFromRuns(runs);
  const volPlan = computeWeeklyVolumeFromPlan(trainingPlan);

  const runsSection =
    runs.length > 0
      ? runs.map((r, i) => `Lauf ${i + 1}: ${formatRunForContext(r)}`).join("\n")
      : "Noch keine Läufe eingetragen.";

  const profileSection = formatProfileSection(profile);
  const weatherSection = formatWeatherForPrompt(weatherContext);
  const slotsSection = formatSlotsForPrompt(trainingSlots);
  const planSection = formatPlanForPrompt(trainingPlan);

  return `${dateRef.promptBlock}

${extraContextPayload ? `${extraContextPayload}\n\n` : ""} 

Du bist PaceMind, der KI-Laufcoach von PerformanceProtokoll. Antworte IMMER auf Deutsch.

## Deine Persönlichkeit
- Sprich ${vorname} direkt mit dem Vornamen an – klar und persönlich.
- Sei konkret. Kein Blabla.
- Gib einen klaren nächsten Schritt.
- Warne bei Übertraining oder unrealistischen Distanzen.
- Beziehe Wetter (heute & morgen) ein, wenn relevant.

## Fachwissen (Distanzen & Intensität)
${coachKnowledge}

## Aktuelles Volumen (für Distanzberechnung)
- Gelaufene km diese Kalenderwoche: ${volRuns.thisWeekKm} km
- Gelaufene km letzte 7 Tage: ${volRuns.last7DaysKm} km
- Geplante km diese Woche (Plan): ${volPlan} km

## 1. Nutzerprofil
${profileSection}

## 2. Trainingszeitslots
${slotsSection}
WICHTIG: Zeitslots sind Standard-Verfügbarkeiten ("normalerweise habe ich hier Zeit"), kein hartes Limit. Spontanes Training ist immer möglich – auch an Tagen ohne Slot oder außerhalb der Slot-Uhrzeit.

## 3. Trainingsplan nächste 14 Tage (IST-Zustand – vor jeder Aussage prüfen)
${planSection}

## 4. Letzte 5 Läufe
${runsSection}

## 5. Wetter (heute & morgen)
${weatherSection}

## Konsistenz-Regeln (KRITISCH)
1. Prüfe IMMER Abschnitt 3, bevor du über „heute“, „morgen“ oder den Plan sprichst.
2. „Morgen“ ist ${dateRef.morgen.short} (${dateRef.morgen.iso}) – nicht ein anderer Wochentag.
3. Sage NIE „Ich habe den Plan angepasst“, wenn du keine Action sendest.
4. Widerspreche nicht dem Plan in derselben Nachricht (z. B. nicht „morgen Langlauf“ wenn morgen laut Plan Pause steht).
5. Bei Ausfall heute: nenne das heutige Training mit exaktem Datum aus dem Plan, dann das nächste geplante Training mit Datum.
6. Frage bei größeren Anpassungen der Woche nach („Soll ich die übrigen Wochentage anpassen?“), statt still alles umzuplanen.

## Plan ändern – NUR gezielt, NIE den ganzen Plan löschen

### Einzelne Änderung (Standard)
Nutze action "update_single_day" – ändert GENAU EINEN Tag in der Datenbank. Alle anderen Tage bleiben unverändert.

{
  "text": "Ich habe Dienstag 26.05. auf Regeneration geändert.",
  "action": "update_single_day",
  "data": {
    "datum": "YYYY-MM-DD",
    "trainingstyp": "locker|tempo|intervall|langlauf|pause|Regeneration",
    "dauer_minuten": 40,
    "distanz_km": 6,
    "beschreibung": "…",
    "status": "geplant|abgeschlossen|uebersprungen"
  }
}

Beispiele:
- Heute nicht gelaufen → status "uebersprungen" für ${dateRef.heute.iso}
- Ein Tag intensiver/lockerer → nur dieses datum ändern
- Verschieben (einmalig, außerhalb Slots): als spontane Einheit mit add_spontaneous anlegen (und den ursprünglichen Tag ggf. auf pause/uebersprungen setzen)

### Kompletter Neuplan (NUR wenn Nutzer explizit sagt: „neuen Plan“, „Plan neu erstellen“, „von vorne planen“)
{
  "text": "Ich erstelle dir einen komplett neuen Plan.",
  "action": "replan",
  "data": {
    "changes": [
      { "datum": "YYYY-MM-DD", "trainingstyp": "…", "dauer_minuten": 45, "distanz_km": 8, "beschreibung": "…" }
    ]
  }
}
In "changes" nur Tage eintragen, die du wirklich setzen/ändern willst. Keine anderen Tage anfassen.

### Weitere Actions
- update_profile: { gewicht_kg, fitnesslevel, … }
- update_slots: [{ wochentag: 0-6, verfuegbar, uhrzeit_start, uhrzeit_ende }]
- update_slot: einzelner Slot-Tag aktivieren/deaktivieren oder Uhrzeit ändern
- add_spontaneous: einmalige spontane Einheit an einem konkreten Datum eintragen

### Zeitslots direkt ändern
Nutze action "update_slot", wenn der Nutzer seine Standard-Verfügbarkeit ändert (z. B. "ab jetzt auch montags Zeit", "mittwochs nicht mehr", "dienstags erst um 19 Uhr").

{
  "text": "Ich habe Montag als Trainingstag hinzugefügt.",
  "action": "update_slot",
  "data": {
    "wochentag": 0,
    "wochentag_name": "Montag",
    "verfuegbar": true,
    "uhrzeit_start": "17:00",
    "uhrzeit_ende": "18:30"
  }
}

### Spontanes Training eintragen
Nutze action "add_spontaneous", wenn der Nutzer sagt, dass er an einem bestimmten Datum spontan Zeit hat. Wenn Uhrzeit/Trainingstyp fehlen: zuerst nachfragen, dann Action senden.

{
  "text": "Ich habe eine spontane Einheit für Freitag eingeplant.",
  "action": "add_spontaneous",
  "data": {
    "datum": "YYYY-MM-DD",
    "trainingstyp": "Locker|Tempo|Intervall|Langer Lauf",
    "dauer_minuten": 45,
    "distanz_km": 7,
    "beschreibung": "Spontaner lockerer Lauf",
    "uhrzeit_start": "18:00"
  }
}

### Wann JSON vs. Fließtext
- Planänderung gewünscht/bestätigt → NUR JSON mit action
- Beratung ohne Änderung → Fließtext, KEIN JSON
- Unsicher ob Nutzer Änderung will → erst fragen, keine Action

## Medizin & Sicherheit
- Keine Diagnose. Bei Schmerzen: Arzt empfehlen.`;
}

function sumKm(rows) {
  return (rows || []).reduce((acc, r) => acc + (Number(r.distanz_km) || 0), 0);
}

function formatSecondsAsPace(secPerKm) {
  const sec = Math.round(secPerKm);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function computeAveragePaceSecondsPerKmFromRuns(runs) {
  // runs: App-Shape (mapDbRunToApp) mit paceMin/paceSec + distanceKm
  const valid = (runs || []).filter((r) => r?.paceMin != null && r?.distanceKm);
  if (valid.length === 0) return null;
  let totalSec = 0;
  let totalKm = 0;
  for (const r of valid) {
    const secPerKm = Number(r.paceMin) * 60 + Number(r.paceSec || 0);
    const km = Number(r.distanceKm) || 0;
    if (!Number.isFinite(secPerKm) || !Number.isFinite(km) || km <= 0) continue;
    totalSec += secPerKm * km;
    totalKm += km;
  }
  if (totalKm <= 0) return null;
  return totalSec / totalKm;
}

function formatWeeklyWeather(weatherContext, days = 7) {
  if (!weatherContext?.daily?.length) return "Keine Wettervorhersage verfügbar.";
  const lines = [];
  for (let i = 0; i < Math.min(days, weatherContext.daily.length); i++) {
    const d = weatherContext.daily[i];
    lines.push(`${d.date}: ${d.tempMin}–${d.tempMax}°C, Code ${d.weathercode}`);
  }
  return lines.join("\n");
}

function findCurrentWeekInSkeleton(skeleton, todayIso) {
  return (skeleton || []).find(
    (w) => w.startDatum <= todayIso && w.endDatum >= todayIso
  );
}

/**
 * buildContextPayload(userId, supabase)
 *
 * Baut die (nicht-KI) Kontext-Payload, die der KI bei jeder Chat-Anfrage mitgegeben wird.
 * Wichtig: Die Payload ist reines Ergebnis aus Code (Makro-Skelett, Volumen, Zonen, Wetter).
 */
export async function buildContextPayload(userId, supabase, options = {}) {
  const simulatedTodayIso =
    typeof options.simulatedTodayIso === "string"
      ? options.simulatedTodayIso
      : null;
  // 1. Lade Profil
  const { data: profil, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;

  const today = simulatedTodayIso ? new Date(simulatedTodayIso) : new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().split("T")[0];

  // 2. Berechne aktuelles Wochenvolumen (letzte 4 Wochen)
  const since = new Date(today);
  since.setDate(since.getDate() - 28);
  const { data: runs28, error: runsError } = await supabase
    .from("runs")
    .select("created_at, distanz_km, pace")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .lte("created_at", new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });
  if (runsError) throw runsError;

  const aktuellesWochenvolumen = Math.round((sumKm(runs28) / 4) * 10) / 10;

  // 3. Generiere/Lade Makro-Skelett (Fallback: generate)
  let makroSkelett = Array.isArray(profil?.makro_skelett)
    ? profil.makro_skelett
    : null;
  if (!makroSkelett) {
    makroSkelett = generateMacroSkeleton({
      ziel_datum: profil?.ziel_datum,
      hauptziel: profil?.hauptziel || profil?.ziel,
      fitnesslevel: profil?.fitnesslevel,
      aktuellesWochenvolumen,
      trainingstageProWoche: profil?.trainingstage,
    });
  }

  // 4. Finde aktuelle Woche im Skelett
  const aktuelleWoche = findCurrentWeekInSkeleton(makroSkelett, todayIso) || makroSkelett?.[0];
  const gesamtWochen = makroSkelett?.length || null;
  const verbleibendeWochen =
    gesamtWochen && aktuelleWoche?.woche ? gesamtWochen - aktuelleWoche.woche + 1 : null;

  // Ziel-Datum für Anzeige
  const zieldatum = profil?.ziel_datum || profil?.zielDatum || profil?.zieldatum || "";

  // Absolvierte km diese Woche (Kalenderwoche) aus runs28 – grobe, aber schnell.
  // (Für präzise Bucket-Logik kann später auf computeWeeklyVolumeFromRuns mit mapDbRunToApp umgestellt werden.)
  let absolvierteKmDieseWoche = 0;
  const weekStart = new Date(today);
  // getDay(): 0=So... -> wir nehmen Mo als Start (ähnlich training-server dateToWochentag)
  const jsDay = weekStart.getDay(); // 0 So
  const daysSinceMon = jsDay === 0 ? 6 : jsDay - 1;
  weekStart.setDate(weekStart.getDate() - daysSinceMon);
  weekStart.setHours(0, 0, 0, 0);
  for (const r of runs28 || []) {
    const d = new Date(r.created_at);
    if (d >= weekStart) absolvierteKmDieseWoche += Number(r.distanz_km) || 0;
  }
  absolvierteKmDieseWoche = Math.round(absolvierteKmDieseWoche * 10) / 10;

  // HF-Zonen
  const maxHF = berechneMaxHF(profil?.alter_jahre, "207-0.7");
  const zonen = maxHF ? herzfrequenzZonen(maxHF) : null;

  // Pace-Zonen (optional) – falls Profil Referenzzeit hergibt
  const paceZonen =
    profil?.ref_5k_zeit && (profil?.ref_5k_distanz_km || 5)
      ? paceZonenFromReferenzzeit({
          referenzDistanzKm: profil.ref_5k_distanz_km || 5,
          referenzZeit: profil.ref_5k_zeit,
        })
      : null;

  // Nächste Einheiten (aus training_plan)
  const { data: plan14 } = await supabase
    .from("training_plan")
    .select("*")
    .eq("user_id", userId)
    .gte("datum", todayIso)
    .order("datum", { ascending: true })
    .limit(14);

  const naechsteEinheiten = (plan14 || [])
    .filter((e) => e.trainingstyp && e.trainingstyp !== "pause" && e.status !== "uebersprungen")
    .slice(0, 3)
    .map((e) => {
      const avgPaceSec = null; // wird aktuell nicht aus DB-Runs gemappt, kommt später aus Plan-Engine
      const zielPace = paceZonen?.easy_zone2?.min || null;
      const anatomy = buildEinheitAnatomie({
        trainingstyp: e.trainingstyp,
        hauptteilMinuten: e.dauer_minuten || 30,
        zielPace,
        zielZoneName: e.trainingstyp === "intervall" ? "Zone 4-5" : e.trainingstyp === "tempo" ? "Zone 3-4" : "Zone 2",
        zielRpe: e.trainingstyp === "intervall" ? "8-9" : e.trainingstyp === "tempo" ? "6-7" : "3-4",
      });

      const d = new Date(e.datum);
      const wochentag = d.toLocaleDateString("de-DE", { weekday: "long" });
      return {
        datum: e.datum,
        wochentag,
        trainingstyp: e.trainingstyp,
        distanz_km: e.distanz_km,
        dauer_minuten: e.dauer_minuten,
        ...anatomy,
      };
    });

  const letzteRunsContext = (runs28 || [])
    .slice(0, 5)
    .map((r) => {
      const d = new Date(r.created_at).toLocaleDateString("de-DE");
      return `${d}: ${Number(r.distanz_km) || 0} km`;
    })
    .join("\n");

  // Wetter heute & diese Woche
  const wetterContext = await getExtendedWeatherContext(profil);

  const phaseBeschreibung =
    aktuelleWoche?.phase === "basis"
      ? "aerobes Fundament"
      : aktuelleWoche?.phase === "spezifisch"
      ? "Renntempo & Intensität"
      : aktuelleWoche?.phase === "tapering"
      ? "Frische aufbauen"
      : "";

  return `
=== ATHLETEN-KONTEXT ===
Name: ${profil.vorname || ""}
Alter: ${profil.alter_jahre || "?"} | Gewicht: ${profil.gewicht_kg || "?"}kg
Fitnesslevel: ${profil.fitnesslevel || ""}
Ziel: ${(profil.hauptziel || profil.ziel || "")} am ${zieldatum}
Verbleibende Wochen: ${verbleibendeWochen ?? "?"}

=== AKTUELLE TRAININGSPHASE ===
Woche ${aktuelleWoche?.woche ?? "?"} von ${gesamtWochen ?? "?"}
Phase: ${aktuelleWoche?.phase || ""} (${phaseBeschreibung})
Mesozyklus: ${aktuelleWoche?.mesozyklus || ""}
${aktuelleWoche?.deload ? "⚠️ DIESE WOCHE IST DELOAD-WOCHE (-30% Volumen)" : ""}

=== WOCHENBUDGET ===
Gesamtvolumen diese Woche: ${aktuelleWoche?.wochenvolumen_km ?? "?"} km
Davon bereits absolviert: ${absolvierteKmDieseWoche} km
Verbleibend: ${
    aktuelleWoche?.wochenvolumen_km != null
      ? Math.round((aktuelleWoche.wochenvolumen_km - absolvierteKmDieseWoche) * 10) / 10
      : "?"
  } km
Max. Langer Lauf: ${aktuelleWoche?.max_long_run_km ?? "?"} km
Intensitätsverteilung: 80% locker (Zone 1-2), 20% intensiv

=== HERZFREQUENZ-ZONEN ===
Max HF: ${maxHF ?? "?"} bpm (berechnet: 207 - 0.7 * ${profil.alter_jahre || "?"})
${zonen ? `Zone 1 (Regeneration): ${zonen.zone1.min}-${zonen.zone1.max} bpm | RPE ${zonen.zone1.rpe}
Zone 2 (Grundlage): ${zonen.zone2.min}-${zonen.zone2.max} bpm | RPE ${zonen.zone2.rpe}
Zone 3 (Aerobe Schwelle): ${zonen.zone3.min}-${zonen.zone3.max} bpm | RPE ${zonen.zone3.rpe}
Zone 4 (Anaerobe Schwelle): ${zonen.zone4.min}-${zonen.zone4.max} bpm | RPE ${zonen.zone4.rpe}
Zone 5 (Maximal): ${zonen.zone5.min}-${zonen.zone5.max} bpm | RPE ${zonen.zone5.rpe}` : "Keine HF-Zonen berechenbar (Alter fehlt)."}

=== NÄCHSTE TRAININGSEINHEITEN ===
${naechsteEinheiten.length ? naechsteEinheiten.map(e =>
  `${e.datum} (${e.wochentag}): ${e.trainingstyp} | ${e.distanz_km ?? "?"}km | ${e.dauer_minuten ?? "?"}min
   Warm-up: ${e.warmup}
   Hauptteil: ${e.hauptteil}
   Cool-down: ${e.cooldown}
   Zweck: ${e.zweck}`
).join("\n") : "Keine geplanten Einheiten in den nächsten Tagen gefunden."}

=== LETZTE LÄUFE (Formanalyse) ===
${letzteRunsContext || "Keine Läufe in den letzten 4 Wochen gefunden."}

=== WETTER HEUTE & DIESE WOCHE ===
${formatWeatherForPrompt(wetterContext)}

Wochenausblick:
${formatWeeklyWeather(wetterContext, 7)}

=== WICHTIGE REGELN FÜR DEINE ANTWORTEN ===
1. Gib NIEMALS vage Anweisungen. Immer: exakte Pace, HF-Zone oder RPE.
2. Der Long Run darf MAXIMAL ${aktuelleWoche?.max_long_run_km ?? "?"}km sein.
3. Das Wochenvolumen darf MAXIMAL ${aktuelleWoche?.wochenvolumen_km ?? "?"}km sein.
4. Diese Woche: ${
    aktuelleWoche?.wochenvolumen_km != null
      ? `${Math.round(aktuelleWoche.wochenvolumen_km * 0.8)}km locker, ${Math.round(aktuelleWoche.wochenvolumen_km * 0.2)}km intensiv.`
      : "80/20-Regel anwenden."
  }
5. Erkläre immer WARUM eine Einheit sinnvoll ist (physiologischer Zweck).
6. Bei Deload-Woche: Volumen reduzieren, Intensität halten.
7. Beziehe das Wetter in jeden Trainingsvorschlag ein.
  `.trim();
}
