/**
 * Wissenschaftlich fundierte Trainingsprinzipien für den PaceMind-Coach.
 * Die KI wendet diese Regeln bei Empfehlungen und Distanzberechnung an.
 */

export const coachKnowledge = `
## Trainingsprinzipien (verbindlich)

### Intensitätsverteilung
- 80/20-Regel: ca. 80 % des Volumens in Zone 2 (locker, Gesprächstempo), ca. 20 % intensiv (Tempo, Intervall).
- Nach intensiver Einheit (Tempo/Intervall): mindestens 1 Ruhetag oder lockerer Lauf davor/danach.

### Wochenvolumen
- Steigerung max. 10 % pro Woche gegenüber der Vorwoche.
- Orientierung nach Level (nicht als starres Limit, sondern als sicherer Rahmen):
  - Einsteiger (< 6 Monate Lauf): Aufbau Richtung 30–35 km/Woche
  - Hobby (regelmäßig > 6 Monate): 35–60 km/Woche realistisch
  - Fortgeschritten: 60–100 km/Woche möglich
- Berechne Distanzen aus dem aktuellen Wochenvolumen (letzte Läufe + Plan), Fitnesslevel, Ziel und verbleibenden Wochen bis Zieldatum.

### Langer Lauf
- Ziel: ca. 30–35 % der Wochenkilometer, nicht willkürlich hohe km.
- Minimum ca. 8 km; Maximum abhängig von Level, aktuellem Volumen und Trainingsstand.
- Nie 36 km o.ä. vorschlagen ohne Kontext (Volumen, Ziel, Historie).

### Tapering
- Letzte 2–3 Wochen vor Wettkampf/Zieldatum: 20–40 % Volumenreduktion, Intensität reduzieren.

### Regeneration
- Mindestens 1 echter Ruhetag pro Woche.
- Nach langem Lauf (> 12 km oder Langlauf-Einheit): nächste Trainingseinheit Regeneration oder Pause.

### Planänderungen
- Nur Tage ändern, die der Nutzer betrifft oder die er ausdrücklich anpassen will.
- Vor Aussagen zum Plan: aktuellen 14-Tage-Plan im Kontext prüfen.
- Sage nie „Plan angepasst“, wenn keine Action ausgeführt wird.
- Sage nie „morgen X“, wenn laut Plan morgen bereits Y steht – referenziere exakt den Plan-Eintrag.

### Zeitslots
- Training nur an Tagen mit verfuegbar = true planen oder verschieben.
- Verschieben auf Tag ohne Slot: im Gespräch nachfragen, nicht stillschweigend eintragen.
`.trim();

/**
 * Herzfrequenz-Zonen (bpm) basierend auf maxHF.
 * Rückgabewerte werden gerundet, damit sie im UI/Prompt sauber erscheinen.
 */
export const herzfrequenzZonen = (maxHF) => {
  const hf = Number(maxHF);
  if (!Number.isFinite(hf) || hf <= 0) {
    throw new Error("herzfrequenzZonen: maxHF muss eine positive Zahl sein");
  }
  const r = (n) => Math.round(n);
  return {
    zone1: {
      min: r(hf * 0.5),
      max: r(hf * 0.6),
      name: "Regeneration",
      rpe: "1-2",
    },
    zone2: {
      min: r(hf * 0.6),
      max: r(hf * 0.7),
      name: "Grundlage",
      rpe: "3-4",
    },
    zone3: {
      min: r(hf * 0.7),
      max: r(hf * 0.8),
      name: "Aerobe Schwelle",
      rpe: "5-6",
    },
    zone4: {
      min: r(hf * 0.8),
      max: r(hf * 0.9),
      name: "Anaerobe Schwelle",
      rpe: "7-8",
    },
    zone5: {
      min: r(hf * 0.9),
      max: r(hf * 1.0),
      name: "Maximale Intensität",
      rpe: "9-10",
    },
  };
};

/**
 * Berechnet die maximale Herzfrequenz nach der genauesten verfügbaren Formel.
 * Berücksichtigt Alter und Geschlecht für höhere Präzision.
 */
export function berechnePraeziseMaxHF(alter, geschlecht = "maennlich") {
  const age = Number(alter);
  if (!Number.isFinite(age) || age <= 0) return null;
  
  const g = String(geschlecht).toLowerCase().trim();
  const isFemale = g.startsWith("f") || g.startsWith("w");
  
  if (age < 30) {
    return Math.round(208 - (0.7 * age)); // Tanaka für alle unter 30
  } else if (age <= 50) {
    return Math.round(207 - (0.7 * age)); // Tanaka Standard
  } else {
    // Über 50: geschlechtsspezifische Formeln
    if (isFemale) {
      return Math.round(206 - (0.88 * age)); // Gulati für Frauen
    } else {
      return Math.round(205 - (0.5 * age)); // für Männer
    }
  }
}

/**
 * Schätzt die Ruheherzfrequenz basierend auf Fitnesslevel.
 * Kann durch tatsächliche Messung überschrieben werden.
 */
export function schaetzeRuheHF(fitnesslevel) {
  const lvl = String(fitnesslevel).toLowerCase().trim();
  if (lvl.startsWith("ein")) return 70; // Einsteiger
  if (lvl.startsWith("fort")) return 55; // Fortgeschritten
  return 62; // Hobby
}

/**
 * Herzfrequenz-Zonen nach Karvonen-Methode (präziser als % von maxHF).
 * Verwendet Herzfrequenz-Reserve: HFR = maxHF - ruheHF
 * Zone = ruheHF + (HFR * Prozent)
 */
export function berechneKarvonenZonen({ maxHF, ruheHF }) {
  const max = Number(maxHF);
  const ruhe = Number(ruheHF);
  
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error("berechneKarvonenZonen: maxHF muss eine positive Zahl sein");
  }
  if (!Number.isFinite(ruhe) || ruhe <= 0) {
    ruhe = 62; // Fallback wenn nicht angegeben
  }
  
  const hfReserve = max - ruhe;
  const r = (n) => Math.round(n);
  
  return {
    zone1: {
      min: r(ruhe + hfReserve * 0.50),
      max: r(ruhe + hfReserve * 0.60),
      name: "Regeneration",
      beschreibung: "Aktive Erholung, fördert Durchblutung",
      rpe: "1-2",
      laktat: "< 1 mmol/L",
      gefuehl: "Sehr leicht, problemlos unterhaltbar"
    },
    zone2: {
      min: r(ruhe + hfReserve * 0.60),
      max: r(ruhe + hfReserve * 0.70),
      name: "Aerobe Grundlage",
      beschreibung: "Fettverbrennung, Mitochondrien-Biogenese",
      rpe: "3-4",
      laktat: "1-2 mmol/L",
      gefuehl: "Locker, Gespräch möglich"
    },
    zone3: {
      min: r(ruhe + hfReserve * 0.70),
      max: r(ruhe + hfReserve * 0.80),
      name: "Aerob-Anaerobe Schwelle",
      beschreibung: "Erhöht aerobe Kapazität, verbessert Laktatclearance",
      rpe: "5-6",
      laktat: "2-3 mmol/L",
      gefuehl: "Anspruchsvoll, kurze Sätze möglich"
    },
    zone4: {
      min: r(ruhe + hfReserve * 0.80),
      max: r(ruhe + hfReserve * 0.90),
      name: "Laktatschwelle / Tempo",
      beschreibung: "Verschiebt anaerobe Schwelle, maximiert Laktattoleranz",
      rpe: "7-8",
      laktat: "3-5 mmol/L",
      gefuehl: "Sehr anspruchsvoll, kaum sprechen möglich"
    },
    zone5: {
      min: r(ruhe + hfReserve * 0.90),
      max: max,
      name: "VO2max / Neuromuskulär",
      beschreibung: "Maximiert VO2max, erhöht Laufökonomie",
      rpe: "9-10",
      laktat: "> 5 mmol/L",
      gefuehl: "Maximal, nur kurze Intervalle möglich"
    },
    maxHF: max,
    ruheHF: ruhe,
    hfReserve: hfReserve
  };
}

/**
 * MaxHF Standardformeln:
 * - 220 - Alter
 * - 207 - 0.7 * Alter (für Erwachsene oft näher dran)
 */
export function berechneMaxHF(alterJahre, formel = "207-0.7") {
  const age = Number(alterJahre);
  if (!Number.isFinite(age) || age <= 0) return null;
  if (formel === "220-alter") return Math.round(220 - age);
  return Math.round(207 - 0.7 * age);
}

function paceStringFromSeconds(secPerKm) {
  const sec = Math.round(secPerKm);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function parseTimeToSeconds(timeStr) {
  // Akzeptiert "MM:SS" oder "HH:MM:SS"
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/**
 * Pace-Zonen basierend auf Referenzzeit (5K oder 10K).
 * Input: referenzDistanzKm (5 oder 10) + referenzZeit ("MM:SS" oder "HH:MM:SS")
 *
 * Regeln (aus Spezifikation):
 * - Easy Pace (Zone 2): 5K Pace + 90-120 s/km
 * - Tempo Pace (Zone 3-4): 5K Pace + 15-30 s/km
 * - Intervall Pace (Zone 4-5): 5K Wettkampfpace
 * - Long Run Pace: Easy Pace
 */
export function paceZonenFromReferenzzeit({
  referenzDistanzKm,
  referenzZeit,
}) {
  const dist = Number(referenzDistanzKm);
  const totalSec = parseTimeToSeconds(referenzZeit);
  if (!Number.isFinite(dist) || dist <= 0 || !Number.isFinite(totalSec) || totalSec <= 0) {
    return null;
  }
  const secPerKm = totalSec / dist;

  const easyMin = secPerKm + 90;
  const easyMax = secPerKm + 120;
  const tempoMin = secPerKm + 15;
  const tempoMax = secPerKm + 30;
  const interval = secPerKm;

  return {
    easy_zone2: { min: paceStringFromSeconds(easyMin), max: paceStringFromSeconds(easyMax) },
    tempo_zone3_4: { min: paceStringFromSeconds(tempoMin), max: paceStringFromSeconds(tempoMax) },
    intervall_zone4_5: { ziel: paceStringFromSeconds(interval) },
    longrun: { min: paceStringFromSeconds(easyMin), max: paceStringFromSeconds(easyMax) },
    basis: {
      referenz_pace: paceStringFromSeconds(secPerKm),
      referenz_distanz_km: dist,
      referenz_zeit: referenzZeit,
    },
  };
}

/**
 * Anatomie / Struktur einer Einheit (Textblöcke für UI/Prompt).
 * Optional kann eine Ziel-Pace als String ("X:XX") reingereicht werden.
 */
export function buildEinheitAnatomie({
  trainingstyp,
  hauptteilMinuten,
  zielPace,
  zielZoneName,
  zielRpe,
  zweck,
  koerperliche_anpassung,
}) {
  const paceHint = zielPace ? `, ca. ${zielPace} min/km` : "";
  const zoneHint = zielZoneName ? `${zielZoneName}` : "Zone";
  const rpeHint = zielRpe ? `, RPE ${zielRpe}` : "";

  return {
    warmup: "10 Min locker (Zone 1, RPE 2)",
    hauptteil: `${hauptteilMinuten} Min ${zoneHint}${rpeHint}${paceHint}`,
    cooldown: "5 Min Gehen + Dehnen",
    zweck: zweck || "Verbessert die Laufökonomie und aerobe Basis",
    koerperliche_anpassung:
      koerperliche_anpassung ||
      "Stärkt Herz-Kreislauf-System, Kapillarisierung und mitochondriale Anpassungen",
  };
}
