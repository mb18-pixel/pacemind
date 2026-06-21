import {
  coachKnowledge,
  sportArten,
  berechneMaxHF,
  herzfrequenzZonen,
  paceZonenFromReferenzzeit,
  buildEinheitAnatomie,
  berechnePraeziseMaxHF,
  schaetzeRuheHF,
  berechneKarvonenZonen,
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
import {
  computeAthleteLeistungsprofil,
  generateMacroSkeleton,
  calculatePaceImprovement,
  analyseBefinden,
  analyseHerzfrequenzDrift,
  berechneACWR,
  berechneTrimpScore,
} from "./training-engine";

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
  // Sicherheitscheck
  if (!profile) return 'Du bist ein Laufcoach.';
  
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

  // Build sport types reference for the coach
  const sportArtenReference = Object.entries(sportArten).map(([key, sport]) => {
    const typen = Array.isArray(sport.trainingstypen)
      ? sport.trainingstypen.join(", ")
      : null;
    let info = `${sport.name}${typen ? `: ${typen}` : ""} | Einheit: ${sport.einheit}`;
    if (sport.laufäquivalent) info += ` | Laufäquivalent: ${sport.laufäquivalent}`;
    if (sport.klassifizierung) info += ` | Kategorie: ${sport.klassifizierung}`;
    if (sport.hinweis) info += ` | Hinweis: ${sport.hinweis}`;
    return info;
  }).join("\n");

  // Ziel & Coaching-Modus (Teil 1)
  const zielTyp = profile?.hauptziel || profile?.ziel || "";
  const istGesundheitsziel = ['gesund bleiben', 'fit bleiben', 'abnehmen', 'gesund'].includes(zielTyp.toLowerCase());
  
  const profilKontext = `
=== ATHLETENPROFIL ===
Name: ${profile.vorname || 'Athlet'}
Alter: ${profile.alter_jahre || 'unbekannt'} Jahre
Geschlecht: ${profile.geschlecht || 'unbekannt'}
KFA: ${profile.koerperfettanteil || 'unbekannt'}%
Fitnesslevel: ${profile.fitnesslevel || 'unbekannt'}
Stadt: ${profile.stadt || 'unbekannt'}

=== ZIEL ===
Ziel: ${profile.hauptziel || 'unbekannt'}
${istGesundheitsziel ? 
  'Art: Gesundheitsziel (KEIN Wettkampf, KEINE Zielzeiten erwähnen)' : 
  `Wettkampfdistanz: ${profile.zieldistanz || 'unbekannt'}
Zieldatum: ${profile.ziel_datum || 'nicht gesetzt'}
Zielzeit: ${profile.zielzeit || 'nicht gesetzt'}
Zielpace: ${profile.zielpace || 'nicht gesetzt'}`
}

=== AKTUELLER STAND ===
Trainingsfrequenz aktuell: ${profile.aktuelle_trainingsfrequenz || 'unbekannt'}
Typische Distanz: ${profile.aktuelle_distanz || 'unbekannt'}
Referenzzeit 5K: ${profile.referenzzeit_5k || 'keine'}
Referenzzeit 10K: ${profile.referenzzeit_10k || 'keine'}
Trainingstage pro Woche: ${profile.trainingstage || 'unbekannt'}
`;
  
  let zielLogik = "";
  if (istGesundheitsziel) {
    zielLogik = `WICHTIG: Dieser Nutzer hat KEIN Wettkampfziel.
- Erwähne NIEMALS Zielzeiten, Wettkämpfe oder Tapering.
- Fokus auf Wohlbefinden, Konsistenz und Freude.
- Frage regelmäßig wie sich der Nutzer fühlt.
${zielTyp.toLowerCase() === 'abnehmen' ? "- Fokus auf Zone 2 Läufe (Fettverbrennung).\n- Kombiniere Tipps mit Hinweisen, dass ein gesundes Kaloriendefizit durch Konsistenz entsteht.\n- Keine extremen Hochintensiv-Einheiten dominieren lassen.\n- Warnung bei zu aggressivem Abnehmen + Sport." : "- Keine Intervalle außer der Nutzer fragt explizit danach.\n- Trainingsplan: locker, ohne Druck.\n- Maximales Wochenvolumen: 30km unabhängig vom Level."}`;
  } else {
    zielLogik = `WICHTIG: Dieser Nutzer trainiert für ein Leistungsziel: ${zielTyp}
- Zieldatum: ${profile?.ziel_datum || 'unbekannt'}
- Zielzeit: ${profile?.zielzeit || 'noch nicht festgelegt'}
- Plane strukturiert auf dieses Datum hin (Aufbau, Spezifisch, Tapering).
- Nutze Intervalle und Tempoläufe je nach Phase.
- Gib konkrete Zeitprognosen.`;
  }

  return `THEMEN-BESCHRÄNKUNG (KRITISCH):
Du bist ausschließlich ein Lauf- und Ausdauer-Coach.
Du sprichst NUR über folgende Themen:

ERLAUBT:
- Lauftraining, Trainingsplanung, Pace, Distanz
- Herzfrequenz, Trainingszonen, VDOT
- Regeneration, Schlaf, Erholung
- Ernährung im Kontext Sport (Pre/Post Workout)
- Verletzungsprävention, Dehnübungen
- Ausrüstung (Laufschuhe, Uhr, Kleidung)
- Motivation im Kontext Training
- Andere Ausdauersportarten (Rad, Schwimmen)
- Wettkampfvorbereitung

NICHT ERLAUBT:
- Politik, Nachrichten, Weltgeschehen
- Beziehungen, persönliche Probleme
- Finanzen, Karriere, Schule
- Unterhaltung, Filme, Musik
- Technologie außer Sport-Gadgets
- Alles was nicht mit Sport zu tun hat

WENN NUTZER EIN FREMDES THEMA ANSPRICHT:
Antworte freundlich aber klar:
'Ich bin dein Laufcoach und kenne mich nur mit Training und Regeneration aus. Wie kann ich dir beim Sport helfen?'

NIEMALS:
- Auf fremde Themen eingehen
- Allgemeinwissen teilen
- Als normaler Chatbot agieren

Du bist Ascend, ein professioneller KI-Laufcoach.

ABSOLUTE GRUNDREGELN:

REGEL 1 – NIEMALS JSON IN ANTWORTEN:
Deine Antwort an den Nutzer ist IMMER natürliche deutsche Sprache. JSON wird nur intern verarbeitet.
Schreibe niemals Klammern, Anführungszeichen oder Schlüssel-Wert-Paare in deine Antwort.

REGEL 2 – VOLLSTÄNDIGE ANTWORTEN:
Antworte nie mit nur 1-2 Wörtern oder rohen Daten.
Minimum: 2-3 vollständige Sätze.

REGEL 3 – WENN NUTZER NACH AKTUELLEM STAND FRAGT:
Fragen wie 'was laufe ich aktuell', 'wie schnell bin ich', 'was ist meine aktuelle Pace' – antworte so:

'Deine aktuelle Einschätzung basierend auf deinem Profil:
5K-Äquivalent: ca. [X] Min ([X:XX] min/km)
Das ist dein Ausgangspunkt – von hier aus arbeiten wir.'

NIEMALS nur Zahlen hinschreiben wie '19:30 5K 6:50 min/km'.

REGEL 4 – WENN NUTZER NACH ZIEL FRAGT:
'Dein Ziel: 5K in [Zeit] am [Datum].
Das sind noch [X] Wochen. [1 motivierender Satz dazu].'

REGEL 5 – TRAININGS ERKLÄREN:
Bei jeder Trainingsfrage: vollständige Struktur mit
Warm-up, Hauptteil, Cool-down, Pace, Puls, RPE.
Niemals nur den Trainingstyp nennen.
Schreibe das alles strukturiert in der Antwort auf.

FORMATIERUNGS-REGELN FÜR ANTWORTEN:

Strukturiere deine Antworten IMMER mit Zeilenumbrüchen.
Niemals einen langen Fließtext-Block schreiben.

Nutze \\n\\n zwischen verschiedenen Gedankenblöcken.

BEISPIEL FALSCH (niemals so):
'Dein Plan für diese Woche: Wir befinden uns in der Aufbauphase. Dein Ziel ist es am 2026-09-01 einen Marathon zu laufen. Heute ist kein Training geplant. Morgen könnten wir mit einem lockeren Lauf beginnen...'

BEISPIEL RICHTIG (immer so):

Dein Ziel: Marathon am 01.09.2026 – noch 11 Wochen.

Heute: kein Training geplant.

Morgen (Mittwoch): Lockerer Lauf
→ 6:50 min/km, Zone 2
→ Baut deine Grundlagenausdauer auf

Nächste Schritte:
→ Intervalltraining kommt diese Woche dazu
→ Wochenvolumen wird schrittweise gesteigert

Konkrete Regeln:
1. Maximal 2-3 Sätze pro Absatz
2. Zwischen Themenblöcken: Leerzeile (\\n\\n)
3. Bei Trainingsdetails: Pfeil-Symbol (→) für Aufzählungen
4. Wichtige Zahlen/Daten: eigene Zeile
5. Nie mehr als 4 Sätze ohne Absatz-Trennung
6. Bei Aufzählungen von Trainings: jedes Training in eigenem Block mit Leerzeile davor

STRUKTUR FÜR WOCHENPLAN-ANTWORTEN:
[Ziel-Statusinfo in 1 Zeile]

[Heute-Info]

[Training X]:
→ Detail 1
→ Detail 2

[Training Y]:
→ Detail 1
→ Detail 2

[Abschluss-Satz oder Tipp]

KRITISCHE REGEL: Wenn du eine Action ausführst, schreibe NIEMALS das JSON in deine Antwort an den Nutzer. Das JSON wird intern verarbeitet. Deine Antwort an den Nutzer ist IMMER nur natürliche Sprache im "text" Feld.

${dateRef.promptBlock}

${extraContextPayload ? `${extraContextPayload}\n\n` : ""} 

## Unterstützte Sportarten
${sportArtenReference}

### Multi-Sport Integration – WICHTIG
Du kannst ALLE Ausdauersportarten planen und einordnen. Wenn der Nutzer eine andere Sportart als Laufen erwähnt:
1. Erkenne sie aus der Liste oben (sportArten)
2. Werte sie mit dem Laufäquivalent um (z.B. 30km Rad × 0.3 = 9km Laufbelastung)
3. Integriere sie in den Trainingsplan als entsprechende Einheit
4. Erkläre kurz, wie sie zum Lauftraining beiträgt

Du bist Ascend, der Laufcoach von PerformanceProtokoll. Antworte IMMER auf Deutsch.

## Deine Persönlichkeit (GRUNDPRINZIPIEN)
- Sprich ${vorname} direkt mit dem Vornamen an – klar und persönlich.
- Sei konkret. Kein Blabla.
- Gib einen klaren nächsten Schritt.
- Nie über das Gewicht des Nutzers reden außer er fragt (Ausnahme: medizinische Warnung bei Extremwerten).
- Alter ist eine Stärke, kein Handicap: "Mit ${profile?.alter_jahre || 'deiner Erfahrung'} bringst du Lebenserfahrung mit. Dein Körper braucht mehr Regeneration – das bedeutet schlaueres Training, nicht weniger."
- KFA ist ein Tool, kein Urteil: Nie Formulierungen wie "du bist übergewichtig". Sachliche Anpassungen ohne Kommentar.
- Ziele respektieren: Wenn jemand gesund bleiben will, kein Druck, keine Wettkampfrhetorik. "Du trainierst für dein Wohlbefinden – das ist das beste Ziel das es gibt."
- Ehrlich aber motivierend: Bei unrealistischen Erwartungen ehrlich bremsen ("Ein Marathon in 8 Wochen bei aktuellem Stand ist zu riskant...").
- Proaktive Fürsorge: Nach harten Wochen nach Schlaf fragen, bei übersprungenen Einheiten sachlich bleiben (kein Vorwurf), bei Schmerzen sofort Pause/Arzt empfehlen.
- Beziehe Wetter still ein – nutze es natürlich im Kontext, ohne es als Feature zu erwähnen.

## Zielbasierte Logik für diesen Athleten:
${zielLogik}

## Verbotene Phrasen (NIEMALS verwenden)
- "Als dein KI-Coach..."
- "Basierend auf deinen Daten..."
- "Ich sehe dass das Wetter..."
- "Da ich dein Wetter kenne..."
- "Basierend auf dem Wetter..."
- "Ich weiß dass es heute..."
- "Ich habe deinen Plan analysiert..."
- "Das ist eine großartige Frage!"
- "Natürlich!"
- "Absolut!"

## Erlaubte Formulierungen (so sprechen)
- "Dein Plan für diese Woche: ..."
- "Heute: 8km locker @ 6:50/km, Zone 2"
- "Knie schmerzen → sofort pausieren, kein Risiko"
- "Diese Woche fehlen dir noch 12km für dein Ziel"
- "Morgen früh: Intervalle. 6x800m @ 4:58/km."
- "Bei den Temperaturen heute bietet sich ein lockerer Dauerlauf an"
- "Zieh heute eine leichte Laufjacke an, die 8°C morgen früh sind frisch"

## Fachwissen (Distanzen & Intensität)
${coachKnowledge}

## Aktuelles Volumen (für Distanzberechnung)
- Gelaufene km diese Kalenderwoche: ${volRuns.thisWeekKm} km
- Gelaufene km letzte 7 Tage: ${volRuns.last7DaysKm} km
- Geplante km diese Woche (Plan): ${volPlan} km

## 1. Nutzerprofil
${profilKontext}

${profileSection}

## 2. Trainingszeitslots
${slotsSection}
WICHTIG: Zeitslots sind Standard-Verfügbarkeiten ("normalerweise habe ich hier Zeit"), kein hartes Limit.

## 3. Trainingsplan nächste 14 Tage (IST-Zustand – vor jeder Aussage prüfen)
${planSection}

## 4. Letzte 5 Läufe
${runsSection}

## 5. Bedingungen (Temperatur, Wind, Niederschlag)
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
- Verschieben: alten Tag auf "uebersprungen" setzen und das neue Datum mit "update_single_day" belegen (nur wenn Nutzer das ausdrücklich will)

### Kompletter Neuplan (NUR wenn Nutzer explizit sagt: „neuen Plan“, „Plan neu erstellen“, „von vorne planen“)
{
  "text": "Ich erstelle dir einen komplett neuen Plan.",
  "action": "replan",
  "data": {}
}
WICHTIG: replan regeneriert den Plan neu basierend auf Profil + Zeitslots (nächste 14 Tage).

### Weitere Actions
- update_profile: { vorname, geschlecht, koerperfettanteil, fitnesslevel, hauptziel, ziel_datum, zielzeit, zielpace, zieldistanz, aktuelle_trainingsfrequenz, aktuelle_distanz, referenzzeit_5k, referenzzeit_10k, stadt, latitude, longitude }
  WICHTIG: Das Alter (alter_jahre) kann NICHT über update_profile geändert werden. Falls der Nutzer danach fragt, erkläre freundlich, dass Altersänderungen aus Sicherheitsgründen nicht im Chat möglich sind.
- update_slot: { slots: [{ wochentag: 0-6, wochentag_name, uhrzeit_start, uhrzeit_ende }] } (ersetzt alle Slots; sende immer die KOMPLETTE Liste inkl. unveränderter Tage)
- log_run: { distanz_km, pace, herzfrequenz, befinden, notizen, sport_art }

### Zeitslots direkt ändern
Nutze action "update_slot", wenn der Nutzer seine Standard-Verfügbarkeit ändert (z. B. "ab jetzt auch montags Zeit", "mittwochs nicht mehr", "dienstags erst um 19 Uhr").

{
  "text": "Ich habe Montag als Trainingstag hinzugefügt.",
  "action": "update_slot",
  "data": {
    "slots": [
      { "wochentag": 0, "wochentag_name": "Montag", "uhrzeit_start": "17:00", "uhrzeit_ende": "18:30" }
    ]
  }
}

### Wann JSON vs. Fließtext
- Planänderung gewünscht/bestätigt → NUR JSON mit action
- Beratung ohne Änderung → Fließtext, KEIN JSON
- Unsicher ob Nutzer Änderung will → erst fragen, keine Action

## Absolute Ascend-Regeln
1. Du darfst NIEMALS andere Apps empfehlen (kein Strava, kein Nike Run Club, kein Garmin Connect etc.). Empfehle ausschließlich Ascend.
2. Wenn der Nutzer fragt, ob es eine App (z.B. im App Store oder Google Play Store) gibt, antworte IMMER exakt so:
   "Ascend gibt es als kostenlose Web-App direkt im Browser – du kannst sie auf deinem Homescreen installieren und bekommst dann Push-Benachrichtigungen wie eine native App. Tippe auf dem iPhone auf das Teilen-Icon → 'Zum Homescreen hinzufügen'. Auf Android erscheint automatisch ein Install-Banner."
3. Du kennst alle Ascend-Funktionen und kannst sie erklären:
   - Coach-Chat (Interaktive Beratung und Anpassung)
   - Trainingskalender (Überblick über alle Einheiten)
   - Lauftagebuch (Alle vergangenen Aktivitäten im Detail)
   - Wissenschaftlicher Trainingsplan (Automatisch basierend auf Sportwissenschaft)
   - PWA Installation (Installation direkt auf dem Startbildschirm)
   - Push-Benachrichtigungen (Direkte Erinnerungen im System)
   - Training an Bedingungen anpassen (z. B. Temperatur/Wind)
   - Zeitslots anpassen (Planung basierend auf deinen Wunschzeiten)
4. Wenn der Nutzer nach einer Funktion fragt, die Ascend besitzt (z. B. Zeitslots ändern), erkläre sie konkret und führe den Nutzer dorthin.
5. Nach jedem eingetragenen Lauf fragst du aktiv nach:
   "Wie hat sich der Lauf angefühlt? War die Belastung passend für dein aktuelles Trainingsziel?"
6. Nutze die Zielpace (siehe ZIELPACE ANALYSE im Kontext) als Referenz für Trainingsvorschläge (z. B. "nahe deiner Zielpace", "in deiner Zielpace").
7. Bewerte die Zielpace kritisch: Wenn der Abstand zur aktuellen Durchschnitts-Pace zu groß ist (z. B. über 60 Sekunden/km oder eine wöchentliche Steigerung von mehr als 3-4 Sek/km erforderlich ist), weise den Nutzer freundlich darauf hin und schlage eine gesündere, realistischere Zielpace vor.

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

function parseStructuredBeschreibung(beschreibung) {
  if (!beschreibung || typeof beschreibung !== "string") return null;
  const lines = beschreibung.split("\n").map((l) => l.trim());
  const out = {};
  const map = {
    "Warm-up:": "warmup",
    "Hauptteil:": "hauptteil",
    "Cool-down:": "cooldown",
    "Pace-Ziel:": "pace_ziel",
    "HF-Zone:": "herzfrequenz_zone",
    "RPE:": "rpe",
    "Zweck:": "zweck",
    "Anpassung:": "koerperliche_anpassung",
  };
  for (const line of lines) {
    const key = Object.keys(map).find((k) => line.startsWith(k));
    if (!key) continue;
    out[map[key]] = line.slice(key.length).trim();
  }
  return Object.keys(out).length ? out : null;
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

  // 2b) Athleten-Leistungsprofil (VDOT, Paces, HF-Zonen)
  const leistungsprofil = computeAthleteLeistungsprofil(profil || {});
  const vdotQuelle = profil?.ref_5k_zeit || profil?.ref_10k_zeit
    ? "aus Referenzzeit"
    : "geschätzt aus Fitnesslevel";

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

  // HF-Zonen (Karvonen-Methode für höhere Präzision)
  const maxHF = berechnePraeziseMaxHF(profil?.alter_jahre, profil?.geschlecht) || berechneMaxHF(profil?.alter_jahre, "207-0.7");
  const ruheHF = profil?.ruhe_herzfrequenz || schaetzeRuheHF(profil?.fitnesslevel);
  const karvonenZonen = maxHF && ruheHF ? berechneKarvonenZonen({ maxHF, ruheHF }) : null;
  const zonen = karvonenZonen || (maxHF ? herzfrequenzZonen(maxHF) : null);

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

  const plan14Struktur = (plan14 || [])
    .map((e) => {
      const structured = parseStructuredBeschreibung(e.beschreibung);
      const header = `${e.datum}: ${e.trainingstyp} | ${e.distanz_km ?? "?"}km | ${e.dauer_minuten ?? "?"}min`;
      if (!structured) return header;
      return [
        header,
        `Warm-up: ${structured.warmup || "-"}`,
        `Hauptteil: ${structured.hauptteil || "-"}`,
        `Cool-down: ${structured.cooldown || "-"}`,
        structured.pace_ziel ? `Pace-Ziel: ${structured.pace_ziel}` : null,
        structured.herzfrequenz_zone
          ? `HF-Zone: ${structured.herzfrequenz_zone}`
          : null,
        structured.rpe ? `RPE: ${structured.rpe}` : null,
        structured.zweck ? `Zweck: ${structured.zweck}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const naechsteEinheiten = (plan14 || [])
    .filter((e) => e.trainingstyp && e.trainingstyp !== "pause" && e.status !== "uebersprungen")
    .slice(0, 3)
    .map((e) => {
      const structured = parseStructuredBeschreibung(e.beschreibung);

      // Fallback, falls ältere Einträge noch keine strukturierte Beschreibung haben:
      const zielPace =
        (leistungsprofil?.paces?.easy?.pace || paceZonen?.easy_zone2?.min || null)?.replace?.(" min/km", "") ||
        paceZonen?.easy_zone2?.min ||
        null;

      const fallback = buildEinheitAnatomie({
        trainingstyp: e.trainingstyp,
        hauptteilMinuten: e.dauer_minuten || 30,
        zielPace,
        zielZoneName:
          e.trainingstyp === "intervall"
            ? "Zone 4-5"
            : e.trainingstyp === "tempo"
              ? "Zone 3-4"
              : "Zone 2",
        zielRpe:
          e.trainingstyp === "intervall"
            ? "7-8"
            : e.trainingstyp === "tempo"
              ? "6-7"
              : "3-4",
      });

      const d = new Date(e.datum);
      const wochentag = d.toLocaleDateString("de-DE", { weekday: "long" });
      return {
        datum: e.datum,
        wochentag,
        trainingstyp: e.trainingstyp,
        distanz_km: e.distanz_km,
        dauer_minuten: e.dauer_minuten,
        warmup: structured?.warmup || fallback.warmup,
        hauptteil: structured?.hauptteil || fallback.hauptteil,
        cooldown: structured?.cooldown || fallback.cooldown,
        pace_ziel: structured?.pace_ziel || null,
        herzfrequenz_zone: structured?.herzfrequenz_zone || null,
        rpe: structured?.rpe || null,
        zweck: structured?.zweck || fallback.zweck,
        koerperliche_anpassung:
          structured?.koerperliche_anpassung || fallback.koerperliche_anpassung,
      };
    });

  const letzteRunsContext = (runs28 || [])
    .slice(0, 5)
    .map((r) => {
      const d = new Date(r.created_at).toLocaleDateString("de-DE");
      return `${d}: ${Number(r.distanz_km) || 0} km`;
    })
    .join("\n");

  // Dynamische Trainingsanpassung
  const befindenAnalyse = analyseBefinden(runs28);
  const hfDriftAnalyse = analyseHerzfrequenzDrift(runs28);
  const acwrAnalyse = berechneACWR(runs28, today);

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

  // Zielpace Analyse
  let zielpaceAnalyseSection = "";
  if (profil?.zielpace && profil?.zieldistanz) {
    let totalSec = 0;
    let totalKm = 0;
    for (const r of runs28 || []) {
      const dist = Number(r.distanz_km) || 0;
      const paceParts = String(r.pace || "").split(":");
      if (dist > 0 && paceParts.length >= 2) {
        const paceSec = parseInt(paceParts[0], 10) * 60 + (parseInt(paceParts[1], 10) || 0);
        if (paceSec > 0) {
          totalSec += paceSec * dist;
          totalKm += dist;
        }
      }
    }
    const avgPaceSec = totalKm > 0 ? (totalSec / totalKm) : null;
    const currentAvgPaceStr = avgPaceSec ? formatSecondsAsPace(avgPaceSec) : "-";

    const improvement = calculatePaceImprovement(
      {
        zielpace: profil.zielpace,
        ziel_datum: zieldatum,
        start_datum: todayIso,
      },
      avgPaceSec || (profil.fitnesslevel === "einsteiger" ? 420 : profil.fitnesslevel === "fortgeschritten" ? 300 : 360)
    );

    if (improvement) {
      const diffSec = Math.round(improvement.totalImprovementSec);
      const weeklyDiff = improvement.weeklyImprovementSec.toFixed(1);
      
      zielpaceAnalyseSection = `
=== ZIELPACE ANALYSE ===
Zielpace: ${profil.zielpace}/km für ${profil.zieldistanz} am ${zieldatum}
Aktuelle Pace (Durchschnitt letzte Läufe): ${currentAvgPaceStr}/km
Benötigte Verbesserung: ${diffSec} Sek/km in ${improvement.totalWeeks} Wochen
Wöchentliche Pace-Steigerung: ${weeklyDiff} Sek/km
`.trim();
    } else {
      zielpaceAnalyseSection = `
=== ZIELPACE ANALYSE ===
Zielpace: ${profil.zielpace}/km für ${profil.zieldistanz} am ${zieldatum}
Aktuelle Pace: Keine Läufe vorhanden.
`.trim();
    }
  }

  const lpLines = (() => {
    const vdot = leistungsprofil?.vdot;
    const paces = leistungsprofil?.paces;
    const hf = leistungsprofil?.hf;
    if (!vdot || !paces) return "";

    const z2 = hf?.zone2;
    const z34 = hf?.combined?.zone3_4;
    const z45 = hf?.combined?.zone4_5;

    return `
=== ATHLETEN-LEISTUNGSPROFIL ===
VDOT: ${vdot} (${vdotQuelle})
Easy Pace: ${paces.easy.pace} (Zone 2, ${z2 ? `${z2.min}-${z2.max} bpm` : "?"})
Tempo Pace: ${paces.tempo.pace} (Zone 3-4, ${z34 ? `${z34.min}-${z34.max} bpm` : "?"})
Intervall Pace: ${paces.intervall.pace} (Zone 4-5, ${z45 ? `${z45.min}-${z45.max} bpm` : "?"})
Max HF: ${leistungsprofil?.maxHF ?? "?"} bpm (berechnet: 207 - 0.7 * ${profil.alter_jahre || "?"})
`.trim();
  })();

  // Gesundheitsdaten basierend auf KFA
  let gesundheitsHinweise = [];

  if (profil.alter_jahre && profil.alter_jahre > 55) {
    gesundheitsHinweise.push("- Mehr Regenerationstage einplanen (min. 2 pro Woche).");
    gesundheitsHinweise.push("- Langsamere Progression: max 8% statt 10% pro Woche.");
    gesundheitsHinweise.push("- Mehr Wert auf Warm-up und Cool-down legen.");
    gesundheitsHinweise.push("- Maximales Wochenvolumen konservativer.");
  }

  let kfaKlasse = "Unbekannt";
  if (profil.koerperfettanteil) {
    const kfa = profil.koerperfettanteil;
    const isMale = profil.geschlecht === "maennlich";
    const isFemale = profil.geschlecht === "weiblich";
    
    if ((isMale && kfa > 30) || (isFemale && kfa > 38)) {
      kfaKlasse = "Sehr hoch";
      gesundheitsHinweise.push("- Gelenke schonen, ähnlich wie bei Adipositas.");
      gesundheitsHinweise.push("- Langsamere Pace-Erwartungen.");
      gesundheitsHinweise.push("- Fokus auf Ausdauer aufbauen, nicht Tempo.");
    } else if ((isMale && kfa < 8) || (isFemale && kfa < 15)) {
      kfaKlasse = "Sehr niedrig";
      gesundheitsHinweise.push("- Warnung: sehr niedriger KFA kann Leistung beeinträchtigen.");
      gesundheitsHinweise.push("- Empfehle ausreichend Ernährung. Keine extremen Diäten während Training.");
    } else {
      kfaKlasse = "Normal";
    }
  }

  return `
${zielpaceAnalyseSection ? `${zielpaceAnalyseSection}\n\n` : ""}${lpLines ? `${lpLines}\n\n` : ""}=== ATHLETEN-KONTEXT ===
Name: ${profil.vorname || ""}
Alter: ${profil.alter_jahre || "?"} Jahre
Fitnesslevel: ${profil.fitnesslevel || ""}
Ziel: ${(profil.hauptziel || profil.ziel || "")} am ${zieldatum}
Verbleibende Wochen: ${verbleibendeWochen ?? "?"}

=== GESUNDHEITSPROFIL ===
Alter: ${profil.alter_jahre || "?"} Jahre
KFA: ${profil.koerperfettanteil || "?"}% (${kfaKlasse})

WICHTIGE ANPASSUNGEN FÜR DIESEN ATHLETEN:
${gesundheitsHinweise.length > 0 ? gesundheitsHinweise.join("\n") : "Keine speziellen gesundheitlichen Einschränkungen erfasst."}

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

=== HERZFREQUENZ-ZONEN (Karvonen-Methode) ===
Max HF: ${maxHF ?? "?"} bpm (präzise Berechnung nach Alter/Geschlecht)
Ruhe HF: ${ruheHF ?? "?"} bpm (geschätzt aus Fitnesslevel)
HF-Reserve: ${karvonenZonen?.hfReserve ?? "?"} bpm
${karvonenZonen ? `Zone 1 (Regeneration): ${karvonenZonen.zone1.min}-${karvonenZonen.zone1.max} bpm | RPE ${karvonenZonen.zone1.rpe} | Laktat ${karvonenZonen.zone1.laktat} | ${karvonenZonen.zone1.gefuehl}
Zone 2 (Aerobe Grundlage): ${karvonenZonen.zone2.min}-${karvonenZonen.zone2.max} bpm | RPE ${karvonenZonen.zone2.rpe} | Laktat ${karvonenZonen.zone2.laktat} | ${karvonenZonen.zone2.gefuehl}
Zone 3 (Aerob-Anaerobe Schwelle): ${karvonenZonen.zone3.min}-${karvonenZonen.zone3.max} bpm | RPE ${karvonenZonen.zone3.rpe} | Laktat ${karvonenZonen.zone3.laktat} | ${karvonenZonen.zone3.gefuehl}
Zone 4 (Laktatschwelle/Tempo): ${karvonenZonen.zone4.min}-${karvonenZonen.zone4.max} bpm | RPE ${karvonenZonen.zone4.rpe} | Laktat ${karvonenZonen.zone4.laktat} | ${karvonenZonen.zone4.gefuehl}
Zone 5 (VO2max/Neuromuskulär): ${karvonenZonen.zone5.min}-${karvonenZonen.zone5.max} bpm | RPE ${karvonenZonen.zone5.rpe} | Laktat ${karvonenZonen.zone5.laktat} | ${karvonenZonen.zone5.gefuehl}` : "Keine HF-Zonen berechenbar (Alter fehlt)."}

=== TRAININGSPLAN – NÄCHSTE 14 TAGE (mit Struktur) ===
${plan14Struktur || "Keine Einträge gefunden."}

=== NÄCHSTE TRAININGSEINHEITEN ===
${naechsteEinheiten.length ? naechsteEinheiten.map(e =>
  `${e.datum} (${e.wochentag}): ${e.trainingstyp} | ${e.distanz_km ?? "?"}km | ${e.dauer_minuten ?? "?"}min
Warm-up: ${e.warmup}
Hauptteil: ${e.hauptteil}
Cool-down: ${e.cooldown}
${e.pace_ziel ? `Pace-Ziel: ${e.pace_ziel}\n` : ""}${e.herzfrequenz_zone ? `HF-Zone: ${e.herzfrequenz_zone}\n` : ""}${e.rpe ? `RPE: ${e.rpe}\n` : ""}Zweck: ${e.zweck}
Anpassung: ${e.koerperliche_anpassung}`
).join("\n") : "Keine geplanten Einheiten in den nächsten Tagen gefunden."}

=== LETZTE LÄUFE (Formanalyse) ===
${letzteRunsContext || "Keine Läufe in den letzten 4 Wochen gefunden."}

=== DYNAMISCHE TRAININGSANPASSUNG ===
Befinden letzte 3 Läufe: ${befindenAnalyse.avgBefinden !== null ? `${befindenAnalyse.avgBefinden}/5` : "Nicht verfügbar"}
Empfehlung: ${befindenAnalyse.recommendation}
${befindenAnalyse.warning ? `⚠️ ${befindenAnalyse.warning}` : ""}

Herzfrequenz-Drift: ${hfDriftAnalyse.trend === "insufficient_data" ? "Nicht genug Daten" : `${hfDriftAnalyse.drift ?? 0} bpm (${hfDriftAnalyse.trend})`}
${hfDriftAnalyse.recommendation !== "normal" ? `Empfehlung: ${hfDriftAnalyse.recommendation}` : ""}

Acute:Chronic Workload Ratio (ACWR): ${acwrAnalyse.acwr !== null ? acwrAnalyse.acwr : "Nicht verfügbar"}
Status: ${acwrAnalyse.status}
${acwrAnalyse.recommendation !== "continue" ? `Empfehlung: ${acwrAnalyse.recommendation}` : ""}

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
7. Beziehe Wetter still ein – nutze es im Kontext ("Bei den Temperaturen...", "Die 8°C morgen früh sind frisch..."), erwähne es NIEMALS als Feature ("Ich sehe das Wetter...", "Basierend auf dem Wetter...").
8. Bewerte die Zielpace des Athleten kritisch (siehe ZIELPACE ANALYSE):
   - Wenn die benötigte wöchentliche Pace-Steigerung zu hoch ist (z. B. > 3 Sek/km Steigerung pro Woche) oder der Abstand zur aktuellen Pace zu groß (> 60 Sek/km), weise den Nutzer darauf hin und schlage eine realistischere, gesündere Zielpace vor.
   - Nutze die Zielpace als ständige Referenz für deine Trainingsvorschläge (z. B. "Dein Intervalltraining heute: 6x400m in X:XX (= X:XX/km, nahe deiner Zielpace)").
  `.trim();
}
