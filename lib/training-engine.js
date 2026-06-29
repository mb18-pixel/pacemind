/**
 * Ascend Training Engine – sportwissenschaftliche Logik (deterministisch)
 * -----------------------------------------------------------------------
 * Fokus:
 * 1) Athletenprofil (MaxHF, VDOT, Trainingspaces, HF-Zonen)
 * 2) Wochenvolumen-Progression (Aufbau/Deload/Taper)
 * 3) Makro-Skelett (Wochen-Phasen, Long-Run-Limits, Trainingsmix)
 * 4) Dynamische Trainingsanpassung (Befinden, HR-Drift, ACWR)
 *
 * Hinweis: Die konkrete Tagesplanung (welcher Tag welche Einheit) passiert
 * aktuell im API-Route-Code. Diese Engine liefert dafür robuste Kennzahlen
 * und konsistente Wochen-Parameter.
 */

import { formatDateISO } from "./training-server";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function roundInt(n) {
  return Math.round(n);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatPaceFromSeconds(secPerKm) {
  const sec = Math.round(secPerKm);
  const m = Math.floor(sec / 60);
  const s = pad2(sec % 60);
  return `${m}:${s}`;
}

function parseTimeToSeconds(value) {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value).trim();
  // Unterstützt "MM:SS" oder "HH:MM:SS"
  const parts = str.split(":").map((p) => Number(p));
  if (parts.some((x) => !Number.isFinite(x))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
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

// ─────────────────────────────────────────────────────────────
// Schritt 1 – Athletenprofil (MaxHF, VDOT, Paces, HF-Zonen)
// ─────────────────────────────────────────────────────────────

export function computeMaxHF(alter) {
  const age = Number(alter);
  if (!Number.isFinite(age) || age <= 0) return null;
  // Vorgabe: 207 - 0.7 * Alter
  return roundInt(207 - 0.7 * age);
}

function vdotFromRaceTimeDaniels({ distKm, timeSec }) {
  if (!distKm || !timeSec || timeSec <= 0) return null;

  // Jack Daniels: v in m/min, t in minutes
  const distM = distKm * 1000;
  const tMin = timeSec / 60;
  const v = distM / tMin; // m/min

  const vo2 =
    -4.60 + 0.182258 * v + 0.000104 * Math.pow(v, 2); // ml/kg/min

  const denom =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * tMin) +
    0.2989558 * Math.exp(-0.1932605 * tMin);

  if (!Number.isFinite(vo2) || !Number.isFinite(denom) || denom <= 0) return null;
  const vdot = vo2 / denom;
  if (!Number.isFinite(vdot)) return null;
  return clamp(vdot, 20, 85);
}

function vdotFrom5kTable(timeSec) {
  if (!timeSec) return null;
  const min = timeSec / 60;
  if (min < 20) return 60;
  if (min < 22) return 52;
  if (min < 25) return 46;
  if (min < 28) return 40;
  if (min < 32) return 35;
  return 30;
}

// VDOT 1: Aktueller IST-VDOT (für Trainingszonen) - aus echter Referenzzeit
export function berechneIstVdot(profile = {}) {
  const refTimeSec =
    parseTimeToSeconds(profile.ref_5k_zeit) ??
    parseTimeToSeconds(profile.ref_10k_zeit) ??
    parseTimeToSeconds(profile.referenzzeit_5k) ??
    parseTimeToSeconds(profile.referenzzeit_10k) ??
    null;

  const refDistKm = Number(profile.ref_5k_distanz_km || profile.ref_10k_distanz_km);
  const distKm =
    Number.isFinite(refDistKm) && refDistKm > 0
      ? refDistKm
      : profile.ref_10k_zeit || profile.referenzzeit_10k
        ? 10
        : 5;

  if (refTimeSec) {
    const byFormula = vdotFromRaceTimeDaniels({ distKm, timeSec: refTimeSec });
    if (byFormula) return roundInt(byFormula);
    if (distKm === 5) return vdotFrom5kTable(refTimeSec);
  }

  // Fallback aus Fitnesslevel + Trainingsfrequenz
  return schaetzeVdotAusProfil(profile);
}

// Hilfsfunktion: VDOT aus Profil schätzen (wenn keine Referenzzeit)
function schaetzeVdotAusProfil(profile = {}) {
  const lvl = normalizeFitnesslevel(profile.fitnesslevel);
  let baseVdot = lvl === "einsteiger" ? 28 : lvl === "fortgeschritten" ? 44 : 36;

  // Frauen haben im Schnitt 10-15% niedrigere VO2max
  if (profile.geschlecht === 'weiblich') {
    baseVdot = Math.max(25, baseVdot - 3);
  }

  // Relative VO2max Korrektur durch KFA
  if (profile.kfa) {
    baseVdot = korrigiereVdotMitKfa(baseVdot, profile.kfa, profile.geschlecht);
  }

  return baseVdot;
}

// Relative VO2max Korrektur durch KFA
function korrigiereVdotMitKfa(vdot, kfa, geschlecht) {
  const optimalKfa = geschlecht === 'weiblich' ? 20 : 12;
  const kfaAbweichung = Math.max(0, kfa - optimalKfa);
  // Pro 5% zu hohem KFA: -1 VDOT Punkt
  const kfaKorrektur = Math.floor(kfaAbweichung / 5);
  return Math.max(25, vdot - kfaKorrektur);
}

// VDOT 2: Ziel-VDOT (nur für Zielzeit-Validierung) - aus Zielpace
export function berechneZielVdot(profile = {}) {
  if (!profile.zielpace || !profile.zieldistanz) return null;

  const zielpaceSec = parseTimeToSeconds(profile.zielpace);
  if (!zielpaceSec) return null;

  const distMap = {
    '5k': 5,
    '5 km': 5,
    '5km': 5,
    '10k': 10,
    '10 km': 10,
    '10km': 10,
    'halbmarathon': 21.1,
    'hm': 21.1,
    'marathon': 42.195,
    'm': 42.195
  };

  const distKm = distMap[profile.zieldistanz?.toLowerCase()] || 10;
  const timeSec = zielpaceSec * distKm;

  return vdotFromRaceTimeDaniels({ distKm, timeSec });
}

// Legacy function for backward compatibility
export function estimateVDOT(profile = {}) {
  return berechneIstVdot(profile);
}

const VDOT_PACE_TABLE = [
  { vdot: 30, easy: "8:30", tempo: "7:10", intervall: "6:20" },
  { vdot: 35, easy: "7:45", tempo: "6:30", intervall: "5:45" },
  { vdot: 40, easy: "7:05", tempo: "5:55", intervall: "5:10" },
  { vdot: 42, easy: "6:50", tempo: "5:42", intervall: "4:58" },
  { vdot: 46, easy: "6:25", tempo: "5:20", intervall: "4:38" },
  { vdot: 50, easy: "6:00", tempo: "4:58", intervall: "4:18" },
  { vdot: 52, easy: "5:50", tempo: "4:48", intervall: "4:10" },
  { vdot: 55, easy: "5:35", tempo: "4:35", intervall: "3:58" },
  { vdot: 60, easy: "5:15", tempo: "4:15", intervall: "3:40" },
];

function paceStrToSecPerKm(paceStr) {
  const sec = parseTimeToSeconds(paceStr);
  return sec ? sec : null;
}

function interpolatePaceSec(vdot, key) {
  const table = VDOT_PACE_TABLE;
  const v = Number(vdot);
  if (!Number.isFinite(v)) return null;

  const min = table[0];
  const max = table[table.length - 1];
  if (v <= min.vdot) return paceStrToSecPerKm(min[key]);
  if (v >= max.vdot) return paceStrToSecPerKm(max[key]);

  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (v >= a.vdot && v <= b.vdot) {
      const t = (v - a.vdot) / (b.vdot - a.vdot);
      const aSec = paceStrToSecPerKm(a[key]);
      const bSec = paceStrToSecPerKm(b[key]);
      if (!aSec || !bSec) return null;
      return aSec + t * (bSec - aSec);
    }
  }
  return null;
}

export function computeTrainingPacesFromVDOT(vdot) {
  const easySec = interpolatePaceSec(vdot, "easy");
  const tempoSec = interpolatePaceSec(vdot, "tempo");
  const intervallSec = interpolatePaceSec(vdot, "intervall");
  if (!easySec || !tempoSec || !intervallSec) return null;
  return {
    vdot: roundInt(vdot),
    easy: { secPerKm: easySec, pace: `${formatPaceFromSeconds(easySec)} min/km` },
    tempo: { secPerKm: tempoSec, pace: `${formatPaceFromSeconds(tempoSec)} min/km` },
    intervall: {
      secPerKm: intervallSec,
      pace: `${formatPaceFromSeconds(intervallSec)} min/km`,
    },
  };
}

// HF-Zonen (exakt so, dass das Beispiel passt)
// Prozentbereiche (bezogen auf MaxHF):
// Z1: 60–66%, Z2: 66–76%, Z3: 76–80%, Z4: 80–85%, Z5: 85–90%
export function computeHeartRateZones(maxHF) {
  const max = Number(maxHF);
  if (!Number.isFinite(max) || max <= 0) return null;
  const bpm = (pct) => roundInt((pct / 100) * max);

  const zone1 = { min: bpm(60), max: bpm(66), label: "Zone 1 (Regeneration)", rpe: "2-3" };
  const zone2 = { min: bpm(66), max: bpm(76), label: "Zone 2 (Grundlage)", rpe: "3-4" };
  const zone3 = { min: bpm(76), max: bpm(80), label: "Zone 3 (Aerobe Schwelle)", rpe: "5-6" };
  const zone4 = { min: bpm(80), max: bpm(85), label: "Zone 4 (Schwelle)", rpe: "6-7" };
  const zone5 = { min: bpm(85), max: bpm(90), label: "Zone 5 (VO2max)", rpe: "8-9" };

  return {
    maxHF: max,
    zone1,
    zone2,
    zone3,
    zone4,
    zone5,
    // Kombi-Zonen für Trainingsvorgaben:
    combined: {
      zone1_2: { min: zone1.min, max: zone2.max, label: "Zone 1-2" },
      zone3_4: { min: zone3.min, max: zone4.max, label: "Zone 3-4" },
      zone4_5: { min: zone4.min, max: zone5.max, label: "Zone 4-5" },
    },
  };
}

export function computeAthleteLeistungsprofil(profile = {}) {
  const maxHF = computeMaxHF(profile.alter_jahre ?? profile.alter);
  
  // VDOT 1: Aktueller IST-VDOT (für Trainingszonen)
  const istVdot = berechneIstVdot(profile);
  
  // VDOT 2: Ziel-VDOT (nur für Zielzeit-Validierung)
  let zielVdot = null;
  if (profile.zielpace && profile.zieldistanz) {
    zielVdot = berechneZielVdot(profile);
  }

  // VALIDIERUNG: Ist Ziel realistisch?
  let maxWochensteigerung = 0.10; // Standard: 10%
  let minRuhetageProWoche = 1;
  
  // Ab 55 Jahren Progression verlangsamen
  if (profile.alter_jahre > 55) {
    maxWochensteigerung = 0.07; // 7% statt 10%
    minRuhetageProWoche = 2;    // mindestens 2 Ruhetage
  }

  if (zielVdot && zielVdot > istVdot) {
    const vdotSprung = zielVdot - istVdot;
    const wochen = berechneWochenBisZiel(profile.ziel_datum);
    const maxMoeglicheVerbesserung = wochen * maxWochensteigerung;
    
    if (vdotSprung > maxMoeglicheVerbesserung) {
      // Ziel ist unrealistisch - automatisch korrigieren
      const realistischerZielVdot = istVdot + maxMoeglicheVerbesserung;
      // Hinweis: In einer echten Implementierung würde man dies in die DB schreiben
      console.warn(`Ziel unrealistisch: VDOT-Sprung ${vdotSprung.toFixed(1)} > maximal ${maxMoeglicheVerbesserung.toFixed(1)}`);
    }
  }

  // TRAININGSZONEN IMMER AUS IST-VDOT:
  const paces = computeTrainingPacesFromVDOT(istVdot);
  const hf = maxHF ? computeHeartRateZones(maxHF) : null;
  
  return { 
    maxHF, 
    istVdot, 
    zielVdot,
    vdot: istVdot, // Legacy compatibility
    paces, 
    hf,
    maxWochensteigerung,
    minRuhetageProWoche
  };
}

function berechneWochenBisZiel(zielDatum) {
  if (!zielDatum) return 12; // Default 12 Wochen
  const today = new Date();
  const goal = new Date(zielDatum);
  const diffDays = Math.max(0, Math.ceil((goal - today) / (24 * 60 * 60 * 1000)));
  return Math.max(1, Math.ceil(diffDays / 7));
}

// Prüft ob das Makro-Skelett noch gültig ist
export function skelettIstGueltig(skelett, profil) {
  if (!skelett) return false;
  
  const alter = (new Date() - new Date(skelett.generiert_am)) / 86400000;
  
  if (alter > 28) return false; // älter als 4 Wochen
  if (skelett.ziel !== profil.hauptziel && skelett.ziel !== profil.ziel) return false;
  if (skelett.ziel_datum !== profil.ziel_datum) return false;
  
  return true;
}

// ─────────────────────────────────────────────────────────────
// Schritt 3 – Trainingseinheiten (Deterministik + 80/20-Logik)
// ─────────────────────────────────────────────────────────────

function parseHmToMinutes(hm) {
  if (!hm) return null;
  const parts = String(hm).split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function slotMinuten(start, ende) {
  // Wenn Start/Ende fehlt, ist das Zeitfenster "offen" → keine harte Begrenzung.
  if (!start || !ende) return null;
  const a = parseHmToMinutes(start);
  const b = parseHmToMinutes(ende);
  if (a == null || b == null) return null;
  return Math.max(0, b - a);
}

function slotDurationMinutes(slot) {
  const minutes = slotMinuten(slot?.uhrzeit_start, slot?.uhrzeit_ende);
  // Minimum: 30 Minuten – kürzere Slots ignorieren
  if (minutes == null) return null;
  return minutes >= 30 ? minutes : 0;
}

function dateIsoToWeekdayIndex(dateIso) {
  const d = new Date(dateIso);
  // JS: 0=So ... 6=Sa → DB: 0=Mo ... 6=So
  return (d.getDay() + 6) % 7;
}

function pickBestDate(isoDates, predicate, scoreFn) {
  let best = null;
  let bestScore = -Infinity;
  for (const iso of isoDates) {
    if (predicate && !predicate(iso)) continue;
    const s = scoreFn ? scoreFn(iso) : 0;
    if (s > bestScore) {
      bestScore = s;
      best = iso;
    }
  }
  return best;
}

function intervalPrescription(vdot, phase) {
  const v = Number(vdot);
  const isSpec = phase === "spezifisch";

  const pick = (count, meters, restSec) => ({
    reps: count,
    repMeters: meters,
    restSec,
  });

  if (isSpec) {
    if (v < 35) return pick(6, 400, 90);
    if (v < 45) return pick(4, 1000, 120);
    if (v < 55) return pick(5, 1000, 120);
    return pick(6, 1200, 120);
  }

  // Basis-Phase (geringeres Volumen)
  if (v < 35) return pick(4, 400, 90);
  if (v < 45) return pick(5, 600, 120);
  if (v < 55) return pick(6, 800, 90);
  return pick(8, 1000, 120);
}

function buildBeschreibungBlock(fields) {
  // Ein standardisiertes Textformat, das prompt.js zuverlässig parsen kann.
  const lines = [];
  if (fields.warmup) lines.push(`Warm-up: ${fields.warmup}`);
  if (fields.hauptteil) lines.push(`Hauptteil: ${fields.hauptteil}`);
  if (fields.cooldown) lines.push(`Cool-down: ${fields.cooldown}`);
  if (fields.pace_ziel) lines.push(`Pace-Ziel: ${fields.pace_ziel}`);
  if (fields.herzfrequenz_zone) lines.push(`HF-Zone: ${fields.herzfrequenz_zone}`);
  if (fields.rpe) lines.push(`RPE: ${fields.rpe}`);
  if (fields.laktat_erwartung) lines.push(`Laktat: ${fields.laktat_erwartung}`);
  if (fields.zweck) lines.push(`Zweck: ${fields.zweck}`);
  if (fields.koerperliche_anpassung)
    lines.push(`Anpassung: ${fields.koerperliche_anpassung}`);
  if (fields.hormonell) lines.push(`Hormonell: ${fields.hormonell}`);
  if (fields.distanceAdjusted && fields.originalDistanzKm) {
    lines.push(`Hinweis: Distanz von ${fields.originalDistanzKm}km auf ${fields.distanz_km}km angepasst (Zeitfenster)`);
  }
  if (fields.durationAdjusted && fields.originalDauerMin) {
    lines.push(`Hinweis: Dauer von ${fields.originalDauerMin}min auf ${fields.dauer_minuten}min angepasst (Zeitfenster)`);
  }
  return lines.join("\n");
}

function buildLongRunUnit({ distKm, paces, hf, slotDurationMinutes = null }) {
  const easy = paces.easy.secPerKm;
  const longSec = easy + 12; // 10–15 Sek/km -> Mitte
  let durationMin = Math.round((distKm * longSec) / 60 + 10); // +10' Warm-up/Cool-down (vereinfachtes Modell)
  let adjustedDistKm = distKm;
  let distanceAdjusted = false;
  let durationAdjusted = false;
  let originalDauerMin = null;

  // PROBLEM 6: Passe Distanz an Slot-Dauer an
  if (slotDurationMinutes && durationMin > slotDurationMinutes) {
    originalDauerMin = durationMin;
    // Reduziere Distanz proportional
    const availableMin = slotDurationMinutes - 10; // 10 Min für Warm-up/Cool-down reservieren
    const maxKm = (availableMin * 60) / longSec;
    adjustedDistKm = Math.min(distKm, maxKm);
    durationMin = slotDurationMinutes;
    distanceAdjusted = true;
    durationAdjusted = true;
  }

  const hfZone = hf?.combined?.zone1_2 || { min: 119, max: 131, label: "Zone 1-2" };
  const hfWarmup = hf?.zone1 || { min: 107, max: 119 };
  const hfCooldown = hf?.zone1 || { min: 107, max: 119 };

  return {
    trainingstyp: "langlauf",
    distanz_km: round1(adjustedDistKm),
    dauer_minuten: durationMin,
    distanceAdjusted,
    originalDistanzKm: distanceAdjusted ? round1(distKm) : null,
    durationAdjusted,
    originalDauerMin,
    
    // PRÄZISE PULS-BEREICHE
    herzfrequenz: {
      warmup: `${hfWarmup.min}-${hfWarmup.max} bpm (Zone 1)`,
      hauptteil: `${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
      cooldown: `${hfCooldown.min}-${hfCooldown.max} bpm (Zone 1)`,
      zielzone: `${hfZone.label} | ${hfZone.min}-${hfZone.max} bpm`
    },
    
    // PACE
    pace_ziel: `${formatPaceFromSeconds(longSec)} min/km`,
    pace_warmup: `${formatPaceFromSeconds(easy + 30)} min/km`,
    pace_cooldown: `${formatPaceFromSeconds(easy + 30)} min/km`,
    
    // RPE
    rpe: "3-4 von 10",
    
    // LAKTAT
    laktat_erwartung: "~1.5 mmol/L im Hauptteil",
    
    // STRUKTUR
    warmup: `10 min sehr locker @ ${formatPaceFromSeconds(easy + 30)}/km | ${hfWarmup.min}-${hfWarmup.max} bpm (Zone 1)`,
    hauptteil: `${round1(adjustedDistKm)} km sehr locker @ ${formatPaceFromSeconds(longSec)}/km | ${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
    cooldown: `5 min auslaufen + kurz dehnen @ ${formatPaceFromSeconds(easy + 30)}/km | ${hfCooldown.min}-${hfCooldown.max} bpm (Zone 1)`,
    
    // PHYSIOLOGIE
    zweck: "Aerobe Grundlage stärken, Fettstoffwechsel & Ermüdungsresistenz (Zone 1-2 für ${durationMin - 15} Min akkumuliert)",
    anpassung: "Verbessert Kapillarisierung, mitochondriale Dichte und Laufökonomie bei niedriger Intensität",
    hormonell: "Aktiviert aerobe Stoffwechselwege, fördert Fettverbrennung",
    
    // BESCHREIBUNG (für Kalender-Karte)
    beschreibung: `${round1(adjustedDistKm)}km @ ${formatPaceFromSeconds(longSec)}/km | HF ${hfZone.min}-${hfZone.max} | ${durationMin} Min`
  };
}

function buildEasyUnit({ distKm, paces, hf, slotDurationMinutes = null }) {
  const easy = paces.easy.secPerKm;
  let durationMin = Math.round((distKm * easy) / 60);
  let adjustedDistKm = distKm;
  let distanceAdjusted = false;
  let durationAdjusted = false;
  let originalDauerMin = null;

  // PROBLEM 6: Passe Distanz an Slot-Dauer an
  if (slotDurationMinutes && durationMin > slotDurationMinutes) {
    originalDauerMin = durationMin;
    const maxKm = (slotDurationMinutes * 60) / easy;
    adjustedDistKm = Math.min(distKm, maxKm);
    durationMin = slotDurationMinutes;
    distanceAdjusted = true;
    durationAdjusted = true;
  }

  const hfZone = hf?.zone2 || { min: 119, max: 131, label: "Zone 2" };
  const hfWarmup = hf?.zone1 || { min: 107, max: 119 };
  const hfCooldown = hf?.zone1 || { min: 107, max: 119 };

  return {
    trainingstyp: "locker",
    distanz_km: round1(adjustedDistKm),
    dauer_minuten: durationMin,
    distanceAdjusted,
    originalDistanzKm: distanceAdjusted ? round1(distKm) : null,
    durationAdjusted,
    originalDauerMin,
    
    // PRÄZISE PULS-BEREICHE
    herzfrequenz: {
      warmup: `${hfWarmup.min}-${hfWarmup.max} bpm (Zone 1)`,
      hauptteil: `${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
      cooldown: `${hfCooldown.min}-${hfCooldown.max} bpm (Zone 1)`,
      zielzone: `${hfZone.label} | ${hfZone.min}-${hfZone.max} bpm`
    },
    
    // PACE
    pace_ziel: `${formatPaceFromSeconds(easy)} min/km`,
    pace_warmup: `${formatPaceFromSeconds(easy + 30)} min/km`,
    pace_cooldown: `${formatPaceFromSeconds(easy + 30)} min/km`,
    
    // RPE
    rpe: "3-4 von 10",
    
    // LAKTAT
    laktat_erwartung: "~1.5 mmol/L im Hauptteil",
    
    // STRUKTUR
    warmup: `5 min locker anlaufen @ ${formatPaceFromSeconds(easy + 30)}/km | ${hfWarmup.min}-${hfWarmup.max} bpm (Zone 1)`,
    hauptteil: `${round1(adjustedDistKm)} km locker @ ${formatPaceFromSeconds(easy)}/km | ${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
    cooldown: `5 min auslaufen @ ${formatPaceFromSeconds(easy + 30)}/km | ${hfCooldown.min}-${hfCooldown.max} bpm (Zone 1)`,
    
    // PHYSIOLOGIE
    zweck: "Grundlagenausdauer, aktive Regeneration (Zone 2 für ${durationMin - 10} Min akkumuliert)",
    anpassung: "Verbessert aerobe Kapazität und Laufökonomie",
    hormonell: "Fördert mitochondriale Biogenese und Fettverbrennung",
    
    // BESCHREIBUNG (für Kalender-Karte)
    beschreibung: `${round1(adjustedDistKm)}km @ ${formatPaceFromSeconds(easy)}/km | HF ${hfZone.min}-${hfZone.max} | ${durationMin} Min`
  };
}

function buildRegenUnit({ distKm, paces, hf, slotDurationMinutes = null }) {
  const easy = paces.easy.secPerKm;
  const regenSec = easy + 38; // 30–45 Sek/km -> Mitte
  let durationMin = Math.round((distKm * regenSec) / 60);
  let adjustedDistKm = distKm;
  let distanceAdjusted = false;
  let durationAdjusted = false;
  let originalDauerMin = null;

  // PROBLEM 6: Passe Distanz an Slot-Dauer an
  if (slotDurationMinutes && durationMin > slotDurationMinutes) {
    originalDauerMin = durationMin;
    const maxKm = (slotDurationMinutes * 60) / regenSec;
    adjustedDistKm = Math.min(distKm, maxKm);
    durationMin = slotDurationMinutes;
    distanceAdjusted = true;
    durationAdjusted = true;
  }

  const hfZone = hf?.zone1 || { min: 107, max: 119, label: "Zone 1" };
  const hfWarmup = hf?.zone1 || { min: 107, max: 119 };
  const hfCooldown = hf?.zone1 || { min: 107, max: 119 };

  return {
    trainingstyp: "regeneration",
    distanz_km: round1(adjustedDistKm),
    dauer_minuten: durationMin,
    distanceAdjusted,
    originalDistanzKm: distanceAdjusted ? round1(distKm) : null,
    durationAdjusted,
    originalDauerMin,
    
    // PRÄZISE PULS-BEREICHE
    herzfrequenz: {
      warmup: `${hfWarmup.min}-${hfWarmup.max} bpm (Zone 1)`,
      hauptteil: `${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
      cooldown: `${hfCooldown.min}-${hfCooldown.max} bpm (Zone 1)`,
      zielzone: `${hfZone.label} | ${hfZone.min}-${hfZone.max} bpm`
    },
    
    // PACE
    pace_ziel: `${formatPaceFromSeconds(regenSec)} min/km`,
    pace_warmup: `${formatPaceFromSeconds(regenSec + 15)} min/km`,
    pace_cooldown: `${formatPaceFromSeconds(regenSec + 15)} min/km`,
    
    // RPE
    rpe: "2-3 von 10",
    
    // LAKTAT
    laktat_erwartung: "< 1 mmol/L im Hauptteil",
    
    // STRUKTUR
    warmup: `5 min sehr locker @ ${formatPaceFromSeconds(regenSec + 15)}/km | ${hfWarmup.min}-${hfWarmup.max} bpm (Zone 1)`,
    hauptteil: `${round1(adjustedDistKm)} km Regeneration @ ${formatPaceFromSeconds(regenSec)}/km | ${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
    cooldown: `Kurz mobilisieren @ ${formatPaceFromSeconds(regenSec + 15)}/km | ${hfCooldown.min}-${hfCooldown.max} bpm (Zone 1)`,
    
    // PHYSIOLOGIE
    zweck: "Erholung nach intensiven Reizen, Durchblutung (Zone 1 für ${durationMin - 5} Min akkumuliert)",
    anpassung: "Fördert Regeneration (Muskulatur/Sehnen) ohne zusätzlichen Stress",
    hormonell: "Senkt Cortisol, fördert Recovery-Hormone",
    
    // BESCHREIBUNG (für Kalender-Karte)
    beschreibung: `${round1(adjustedDistKm)}km @ ${formatPaceFromSeconds(regenSec)}/km | HF ${hfZone.min}-${hfZone.max} | ${durationMin} Min`
  };
}

function buildTempoUnit({ phase, weekVolKm, paces, hf, slotDurationMinutes = null }) {
  const easySec = paces.easy.secPerKm;
  const tempoSec = paces.tempo.secPerKm;

  const targetPct = clamp(0.225, 0.20, 0.25);
  const targetKm = weekVolKm * targetPct;

  let tempoMinutes = phase === "spezifisch" ? 40 : 20;
  let tempoKm = (tempoMinutes * 60) / tempoSec;
  let totalKm = 4 + tempoKm; // 2km easy + tempo + 2km easy

  // Wenn totalKm deutlich über Zielanteil liegt, Tempo-Minuten leicht reduzieren
  const maxKm = weekVolKm * 0.25;
  let adjustedTempoMinutes =
    totalKm > maxKm
      ? Math.max(15, Math.round(((maxKm - 4) * tempoSec) / 60))
      : tempoMinutes;
  let adjTempoKm = (adjustedTempoMinutes * 60) / tempoSec;
  let adjTotalKm = 4 + adjTempoKm;

  let durationMin = Math.round((2 * easySec + adjTempoKm * tempoSec + 2 * easySec) / 60);
  let distanceAdjusted = false;
  let durationAdjusted = false;
  let originalDauerMin = null;

  // PROBLEM 6: Passe Distanz an Slot-Dauer an
  if (slotDurationMinutes && durationMin > slotDurationMinutes) {
    originalDauerMin = durationMin;
    // Reduziere Tempo-Minuten proportional
    const availableMin = slotDurationMinutes - 10; // 10 Min für Warm-up/Cool-down reservieren
    const maxTempoMin = availableMin;
    adjustedTempoMinutes = Math.min(adjustedTempoMinutes, maxTempoMin);
    adjTempoKm = (adjustedTempoMinutes * 60) / tempoSec;
    adjTotalKm = 4 + adjTempoKm;
    durationMin = slotDurationMinutes;
    distanceAdjusted = true;
    durationAdjusted = true;
  }

  const hfZone = hf?.combined?.zone3_4 || { min: 131, max: 143, label: "Zone 3-4" };
  const hfWarmup = hf?.zone2 || { min: 119, max: 131 };
  const hfCooldown = hf?.zone2 || { min: 119, max: 131 };

  return {
    trainingstyp: "tempo",
    distanz_km: round1(adjTotalKm),
    dauer_minuten: durationMin,
    distanceAdjusted,
    originalDistanzKm: distanceAdjusted ? round1(totalKm) : null,
    durationAdjusted,
    originalDauerMin,
    
    // PRÄZISE PULS-BEREICHE
    herzfrequenz: {
      warmup: `${hfWarmup.min}-${hfWarmup.max} bpm (Zone 2)`,
      hauptteil: `${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
      cooldown: `${hfCooldown.min}-${hfCooldown.max} bpm (Zone 2)`,
      zielzone: `${hfZone.label} | ${hfZone.min}-${hfZone.max} bpm`
    },
    
    // PACE
    pace_ziel: `${formatPaceFromSeconds(tempoSec)} min/km`,
    pace_warmup: `${formatPaceFromSeconds(easySec)} min/km`,
    pace_cooldown: `${formatPaceFromSeconds(easySec)} min/km`,
    
    // RPE
    rpe: "6-7 von 10",
    
    // LAKTAT
    laktat_erwartung: "~3 mmol/L im Hauptteil",
    
    // STRUKTUR
    warmup: `2 km locker @ ${formatPaceFromSeconds(easySec)}/km | ${hfWarmup.min}-${hfWarmup.max} bpm (Zone 2)`,
    hauptteil: `${adjustedTempoMinutes} min Tempo @ ${formatPaceFromSeconds(tempoSec)}/km | ${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
    cooldown: `2 km locker @ ${formatPaceFromSeconds(easySec)}/km + 5 min dehnen | ${hfCooldown.min}-${hfCooldown.max} bpm (Zone 2)`,
    
    // PHYSIOLOGIE
    zweck: "Schwellentraining, ökonomisches Laufen nahe Renntempo (Zone 3-4 für ${adjustedTempoMinutes} Min akkumuliert)",
    anpassung: "Verbessert Laktat-Steady-State, Kapazität an der Schwelle und Renntempo-Ökonomie",
    hormonell: "Erhöht Wachstumshormone, verbessert aerobe Enzymaktivität",
    
    // BESCHREIBUNG (für Kalender-Karte)
    beschreibung: `${round1(adjTotalKm)}km @ ${formatPaceFromSeconds(tempoSec)}/km | HF ${hfZone.min}-${hfZone.max} | ${durationMin} Min`,
    _targetKm: targetKm,
  };
}

function buildIntervallUnit({ phase, weekVolKm, vdot, paces, hf, slotDurationMinutes = null }) {
  const easySec = paces.easy.secPerKm;
  const intSec = paces.intervall.secPerKm;
  const pres = intervalPrescription(vdot, phase);

  // Basis nach Vorgabe: 2 km WU + Intervalle + 2 km CD
  let reps = pres.reps;
  const repKm = pres.repMeters / 1000;

  const maxKm = weekVolKm * 0.25; // Sicherheitslimit pro Einheit
  const minKm = weekVolKm * 0.15;

  const computeTotalKm = (r) => 4 + r * repKm;

  while (computeTotalKm(reps) > maxKm && reps > 2) reps -= 1;
  while (computeTotalKm(reps) < minKm && reps < pres.reps + 2) reps += 1;

  let intervalKm = reps * repKm;
  let totalKm = 4 + intervalKm;
  let totalRestSec = reps * pres.restSec;

  let durationMin = Math.round(
    (4 * easySec + intervalKm * intSec + totalRestSec) / 60
  );
  let distanceAdjusted = false;
  let durationAdjusted = false;
  let originalDauerMin = null;

  // PROBLEM 6: Passe Distanz an Slot-Dauer an
  if (slotDurationMinutes && durationMin > slotDurationMinutes) {
    originalDauerMin = durationMin;
    // Reduziere Wiederholungen proportional
    const availableMin = slotDurationMinutes - 10; // 10 Min für Warm-up/Cool-down reservieren
    const availableForIntervals = availableMin - 4; // 4 Min für 2km WU/CD bei easy pace
    const maxReps = Math.floor((availableForIntervals * 60) / (repKm * intSec + pres.restSec));
    reps = Math.max(2, Math.min(reps, maxReps));
    intervalKm = reps * repKm;
    totalKm = 4 + intervalKm;
    totalRestSec = reps * pres.restSec;
    durationMin = slotDurationMinutes;
    distanceAdjusted = true;
    durationAdjusted = true;
  }

  const hfZone = hf?.combined?.zone4_5 || { min: 143, max: 155, label: "Zone 4-5" };
  const hfWarmup = hf?.zone2 || { min: 119, max: 131 };
  const hfCooldown = hf?.zone2 || { min: 119, max: 131 };
  const hfRest = hf?.zone1 || { min: 107, max: 119 };

  // Berechne akkumulierte Intensitätszeit
  const repDurationMin = (pres.repMeters / 1000) * intSec / 60;
  const totalIntensityMin = reps * repDurationMin;

  return {
    trainingstyp: "intervall",
    distanz_km: round1(totalKm),
    dauer_minuten: durationMin,
    distanceAdjusted,
    originalDistanzKm: distanceAdjusted ? round1(computeTotalKm(pres.reps)) : null,
    durationAdjusted,
    originalDauerMin,
    
    // PRÄZISE PULS-BEREICHE
    herzfrequenz: {
      warmup: `${hfWarmup.min}-${hfWarmup.max} bpm (Zone 2)`,
      hauptteil: `${hfZone.min}-${hfZone.max} bpm (${hfZone.label})`,
      cooldown: `${hfCooldown.min}-${hfCooldown.max} bpm (Zone 2)`,
      pause: `${hfRest.min}-${hfRest.max} bpm (Zone 1-2)`,
      zielzone: `${hfZone.label} | ${hfZone.min}-${hfZone.max} bpm`
    },
    
    // PACE
    pace_ziel: `${formatPaceFromSeconds(intSec)} min/km`,
    pace_warmup: `${formatPaceFromSeconds(easySec)} min/km`,
    pace_cooldown: `${formatPaceFromSeconds(easySec)} min/km`,
    pace_pause: `${formatPaceFromSeconds(easySec + 30)} min/km`,
    
    // RPE
    rpe: "7-8 von 10",
    
    // LAKTAT
    laktat_erwartung: "~4 mmol/L im Hauptteil",
    
    // STRUKTUR
    warmup: `2 km locker @ ${formatPaceFromSeconds(easySec)}/km | ${hfWarmup.min}-${hfWarmup.max} bpm (Zone 2)`,
    hauptteil: `${reps}x${pres.repMeters}m @ ${formatPaceFromSeconds(intSec)}/km, je ${Math.round(pres.restSec / 60)} min Trabpause @ ${hfRest.min}-${hfRest.max} bpm (Zone 1-2)`,
    cooldown: `2 km locker @ ${formatPaceFromSeconds(easySec)}/km + 5 min dehnen | ${hfCooldown.min}-${hfCooldown.max} bpm (Zone 2)`,
    
    // PHYSIOLOGIE
    zweck: `VO2max-Stimulus, anaerobe Schwelle verschieben (Zone 4-5 für ${Math.round(totalIntensityMin)} Min akkumuliert)`,
    anpassung: "Erhöht mitochondriale Dichte, verbessert Laktattoleranz und Laufeffizienz bei hoher Intensität",
    hormonell: "Aktiviert mTOR-Signalweg, erhöht HGH-Ausschüttung",
    
    // BESCHREIBUNG (für Kalender-Karte)
    beschreibung: `${reps}x${pres.repMeters}m @ ${formatPaceFromSeconds(intSec)}/km | HF ${hfZone.min}-${hfZone.max} | ${round1(totalKm)}km | ${durationMin} Min`
  };
}

export function buildTrainingUnit({
  trainingstyp,
  phase,
  deload,
  weekVolKm,
  maxLongRunKm,
  leistungsprofil,
  slotDurationMinutes = null,
}) {
  const paces = leistungsprofil?.paces;
  const hf = leistungsprofil?.hf;
  const vdot = leistungsprofil?.vdot;
  if (!paces) return null;

  // Distanz wird je nach Typ berechnet/zugewiesen
  if (trainingstyp === "langlauf") {
    const dist = maxLongRunKm || clamp(weekVolKm * 0.30, weekVolKm * 0.28, weekVolKm * 0.32);
    return buildLongRunUnit({ distKm: dist, paces, hf, slotDurationMinutes });
  }
  if (trainingstyp === "tempo") {
    return buildTempoUnit({ phase: deload ? "basis" : phase, weekVolKm, paces, hf, slotDurationMinutes });
  }
  if (trainingstyp === "intervall") {
    // Keine Intervalle in Deload gemäß Vorgabe
    if (deload) return null;
    return buildIntervallUnit({ phase, weekVolKm, vdot, paces, hf, slotDurationMinutes });
  }
  if (trainingstyp === "regeneration") {
    const dist = 5; // 4–6 km fix -> Mitte
    return buildRegenUnit({ distKm: dist, paces, hf, slotDurationMinutes });
  }
  // default: locker
  // Distanz wird später durch Restvolumen gesetzt -> placeholder 0
  return buildEasyUnit({ distKm: 6, paces, hf, slotDurationMinutes });
}

export function generateMicrocycleForDates({
  isoDates,
  weekContext,
  slots,
  leistungsprofil,
}) {
  const dates = (isoDates || []).slice().sort();
  if (dates.length === 0) return [];

  const weekVolKm = Number(weekContext?.wochenvolumen_km) || 0;
  const phase = weekContext?.phase || "basis";
  const deload = Boolean(weekContext?.deload);
  const maxLongRunKm = Number(weekContext?.max_long_run_km) || null;

  const typesWanted = Array.isArray(weekContext?.trainingstypen)
    ? weekContext.trainingstypen.slice()
    : [];

  // Slot lookup - NUR verfuegbar=true Slots
  const slotByWd = new Map();
  for (const s of slots || []) {
    // Minimum: 30 Minuten – kürzere Slots ignorieren
    const dur = slotDurationMinutes(s);
    if (s.verfuegbar === true && (dur == null || dur >= 30)) {
      slotByWd.set(Number(s.wochentag), s);
    }
  }

  const dateScore = (iso) => {
    const wd = dateIsoToWeekdayIndex(iso);
    const slot = slotByWd.get(wd);
    // Offene Slots (ohne Endzeit) werden wie "normal" gewichtet, aber nicht begrenzt.
    const dur = slotDurationMinutes(slot) ?? 60;
    // Wochenende leicht bevorzugen
    const weekendBonus = wd >= 5 ? 30 : 0;
    return dur + weekendBonus;
  };

  const chosen = new Map(); // dateIso -> type
  const remainingDates = new Set(dates);

  const pickAndAssign = (typ, pickFn) => {
    if (!typesWanted.includes(typ)) return;
    const dateIso = pickFn();
    if (!dateIso) return;
    chosen.set(dateIso, typ);
    remainingDates.delete(dateIso);
    // nur einmal
    const idx = typesWanted.indexOf(typ);
    if (idx >= 0) typesWanted.splice(idx, 1);
  };

  // 1) Langer Lauf: NUR EINER pro Woche, auf dem letzten verfügbaren Tag (Wochenende bevorzugt)
  pickAndAssign("langlauf", () =>
    pickBestDate(
      Array.from(remainingDates),
      null,
      (iso) => {
        const wd = dateIsoToWeekdayIndex(iso);
        const slot = slotByWd.get(wd);
        const dur = slotDurationMinutes(slot);
        // Bevorzuge späte Wochentage (Do/Fr/Sa/So) für langen Lauf
        const dayBonus = wd >= 4 ? (wd - 3) * 20 : 0;
        return dur + dayBonus;
      }
    )
  );

  // 2) Intervalle: Di/Mi/Do bevorzugt (wenn vorhanden)
  pickAndAssign("intervall", () =>
    pickBestDate(
      Array.from(remainingDates),
      (iso) => [1, 2, 3].includes(dateIsoToWeekdayIndex(iso)),
      (iso) => dateScore(iso)
    ) ||
    pickBestDate(Array.from(remainingDates), null, (iso) => dateScore(iso))
  );

  // 3) Tempo: Do/Fr bevorzugt
  pickAndAssign("tempo", () =>
    pickBestDate(
      Array.from(remainingDates),
      (iso) => [3, 4].includes(dateIsoToWeekdayIndex(iso)),
      (iso) => dateScore(iso)
    ) ||
    pickBestDate(Array.from(remainingDates), null, (iso) => dateScore(iso))
  );

  // 4) Regeneration: Tag nach intensiver Einheit bevorzugt
  pickAndAssign("regeneration", () => {
    const intenseDates = Array.from(chosen.entries())
      .filter(([, t]) => t === "intervall" || t === "tempo")
      .map(([d]) => d)
      .sort();
    if (intenseDates.length) {
      const lastIntense = intenseDates[intenseDates.length - 1];
      const idx = dates.indexOf(lastIntense);
      if (idx >= 0) {
        for (let i = idx + 1; i < dates.length; i++) {
          const cand = dates[i];
          if (remainingDates.has(cand)) return cand;
        }
      }
    }
    return pickBestDate(Array.from(remainingDates), null, () => 0);
  });

  // PROBLEM 3: Kein intensives Training nach langem Lauf
  // Wenn langer Lauf existiert, der nächste Trainingstag muss locker sein
  const longRunDate = Array.from(chosen.entries()).find(([, t]) => t === "langlauf")?.[0];
  if (longRunDate) {
    const longRunIdx = dates.indexOf(longRunDate);
    if (longRunIdx >= 0) {
      // Finde den nächsten Trainingstag nach dem langen Lauf
      for (let i = longRunIdx + 1; i < dates.length; i++) {
        const nextDate = dates[i];
        if (remainingDates.has(nextDate)) {
          // Dieser Tag muss locker sein (überschreibe falls bereits zugewiesen)
          chosen.set(nextDate, "locker");
          remainingDates.delete(nextDate);
          break;
        }
      }
    }
  }

  // Rest: locker
  for (const iso of Array.from(remainingDates)) {
    chosen.set(iso, "locker");
  }

  // Einheiten bauen (inkl. Distanz-Verteilung für lockere Läufe)
  const planned = [];

  const fixed = [];
  for (const [dateIso, typ] of chosen.entries()) {
    if (typ !== "locker") fixed.push({ dateIso, typ });
  }

  const builtFixed = fixed
    .map(({ dateIso, typ }) => {
      const wd = dateIsoToWeekdayIndex(dateIso);
      const slot = slotByWd.get(wd);
      const slotDuration = slot ? slotDurationMinutes(slot) : null;
      
      return {
        dateIso,
        unit: buildTrainingUnit({
          trainingstyp: typ,
          phase,
          deload,
          weekVolKm,
          maxLongRunKm,
          leistungsprofil,
          slotDurationMinutes: slotDuration,
        }),
      };
    })
    .filter((x) => x.unit); // z.B. Intervall in Deload -> null

  const fixedKm = builtFixed.reduce((acc, x) => acc + (Number(x.unit.distanz_km) || 0), 0);

  const lockerDates = Array.from(chosen.entries())
    .filter(([, t]) => t === "locker")
    .map(([d]) => d);

  const remainingKm = Math.max(0, weekVolKm - fixedKm);
  
  // PROBLEM 5: Erzwinge deutliche Distanzunterschiede
  // Wenn nur ein lockerer Lauf: gib ihm das gesamte Restvolumen
  // Wenn mehrere lockere Läufe: verteile so dass sie deutlich länger als Qualitätseinheiten sind
  let perEasyKm = 0;
  if (lockerDates.length === 1) {
    perEasyKm = clamp(remainingKm, 8, 25); // Ein langer Easy-Run
  } else if (lockerDates.length > 1) {
    // Verteile Restvolumen, aber stelle sicher dass jeder Easy-Run mindestens 8km hat
    // und deutlich mehr als Qualitätseinheiten
    const minEasyKm = 8;
    const maxEasyKm = 20;
    if (remainingKm / lockerDates.length < minEasyKm) {
      // Wenn Restvolumen zu klein für alle Easy-Runs, reduziere auf einen Easy-Run
      perEasyKm = clamp(remainingKm, minEasyKm, maxEasyKm);
      // Entferne überschüssige Easy-Dates
      while (lockerDates.length > 1) {
        const removed = lockerDates.pop();
        chosen.delete(removed);
      }
    } else {
      perEasyKm = clamp(remainingKm / lockerDates.length, minEasyKm, maxEasyKm);
    }
  }

  // Einträge erstellen (DB-kompatibel)
  const buildEntry = (dateIso, unit) => {
    const wd = dateIsoToWeekdayIndex(dateIso);
    const slot = slotByWd.get(wd);
    const beschreibung = buildBeschreibungBlock({
      ...unit,
      distanceAdjusted: unit.distanceAdjusted,
      originalDistanzKm: unit.originalDistanzKm,
    });
    const summary = `${unit.trainingstyp} | ${unit.distanz_km} km | ${unit.dauer_minuten} min`;
    return {
      datum: dateIso,
      trainingstyp: unit.trainingstyp,
      distanz_km: unit.distanz_km,
      dauer_minuten: unit.dauer_minuten,
      beschreibung: `${beschreibung}\n\nKurz: ${summary}`.trim(),
      uhrzeit_start: slot?.uhrzeit_start || null,
      uhrzeit_ende: slot?.uhrzeit_ende || null,
      status: "geplant",
      erstellt_von_ai: false,
      ist_spontan: false,
    };
  };

  // Fixed entries
  for (const x of builtFixed) {
    planned.push(buildEntry(x.dateIso, x.unit));
  }

  // Easy entries
  for (const dateIso of lockerDates) {
    const wd = dateIsoToWeekdayIndex(dateIso);
    const slot = slotByWd.get(wd);
    const slotDuration = slot ? slotDurationMinutes(slot) : null;
    
    const unit = buildEasyUnit({
      distKm: perEasyKm,
      paces: leistungsprofil.paces,
      hf: leistungsprofil.hf,
      slotDurationMinutes: slotDuration,
    });
    planned.push(buildEntry(dateIso, unit));
  }

  // Sort by date
  planned.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  return planned;
}

// ─────────────────────────────────────────────────────────────
// Schritt 2 – Wochenvolumen (Start + Progression + Caps)
// ─────────────────────────────────────────────────────────────

function getStartVolumeFallbackKm(fitnesslevel) {
  switch (fitnesslevel) {
    case "einsteiger":
      return 18;
    case "fortgeschritten":
      return 48;
    default:
      return 32;
  }
}

function getMaxVolumeCapKm(fitnesslevel) {
  switch (fitnesslevel) {
    case "einsteiger":
      return 40;
    case "fortgeschritten":
      return 110;
    default:
      return 65;
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
  const taperPct = 0.15;

  const rawTaper = Math.round(totalWeeks * taperPct);
  const taperWeeks = clamp(rawTaper, 2, 3);
  const taperFinal = totalWeeks <= 3 ? Math.max(1, rawTaper || 1) : taperWeeks;

  let baseWeeks = Math.round(totalWeeks * basePct);
  let specificWeeks = totalWeeks - taperFinal - baseWeeks;
  if (specificWeeks < 0) {
    baseWeeks = Math.max(0, baseWeeks + specificWeeks);
    specificWeeks = 0;
  }
  if (totalWeeks >= 4 && baseWeeks === 0) {
    baseWeeks = 1;
    specificWeeks = Math.max(0, totalWeeks - taperFinal - baseWeeks);
  }

  return { baseWeeks, specificWeeks, taperWeeks: taperFinal };
}

function getPhaseForWeekIndex(weekNumber1Based, phaseWeeks) {
  if (weekNumber1Based <= phaseWeeks.baseWeeks) return "basis";
  if (weekNumber1Based <= phaseWeeks.baseWeeks + phaseWeeks.specificWeeks) return "spezifisch";
  return "tapering";
}

function getMesoForWeekIndex(weekNumber1Based) {
  // Deload: jede 4. Woche
  const deload = weekNumber1Based % 4 === 0;
  return { mesozyklus: deload ? "deload" : "aufbau", deload };
}

function buildTrainingTypesForWeek({ phase, deload, trainingstageProWoche }) {
  const n = Math.max(0, Math.floor(trainingstageProWoche || 0));
  if (n === 0) return [];

  // Prioritäten:
  // - Langlauf, Tempo, (Intervall nur spezifisch + Aufbau), Rest locker/regen
  const types = [];

  const wantLong = n >= 2;
  const wantTempo = n >= 2;
  const wantIntervall = phase === "spezifisch" && !deload && n >= 3;

  if (wantLong) types.push("langlauf");
  if (wantTempo) types.push("tempo");
  if (wantIntervall) types.push("intervall");

  // Regeneration: nach intensiven Einheiten oder in Deload-Wochen
  if ((deload || wantIntervall || wantTempo) && n >= types.length + 1) {
    types.push("regeneration");
  }

  while (types.length < n) types.push("locker");
  return types;
}

// ─────────────────────────────────────────────────────────────
// Schritt 4 – Makro-Skelett (Wochenobjekte)
// ─────────────────────────────────────────────────────────────

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

  let maxCap = getMaxVolumeCapKm(fitnesslevel);
  const startVolCandidate = Number(profile.aktuellesWochenvolumen);
  let startVolume =
    Number.isFinite(startVolCandidate) && startVolCandidate > 0
      ? startVolCandidate
      : getStartVolumeFallbackKm(fitnesslevel);

  const alter = profile.alter_jahre || profile.alter;
  const isOld = alter > 55;

  let trainingstageProWoche =
    Number(profile.trainingstageProWoche ?? profile.trainingstage) || 0;
  
  if (isOld && trainingstageProWoche > 5) {
    trainingstageProWoche = 5; // min. 2 Ruhetage
  }

  const skeleton = [];
  let prevWeekVol = clamp(startVolume, 5, maxCap);

  for (let w = 1; w <= totalWeeks; w++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (w - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const phase = getPhaseForWeekIndex(w, phaseWeeks);
    const { mesozyklus, deload } = getMesoForWeekIndex(w);

    let weekVol = prevWeekVol;

    if (w === 1) {
      weekVol = prevWeekVol;
    } else if (phase === "tapering") {
      weekVol = prevWeekVol * 0.8; // -20% pro Woche
    } else if (deload) {
      weekVol = prevWeekVol * 0.7; // -30% ggü Vorwoche
    } else {
      weekVol = prevWeekVol * (isOld ? 1.08 : 1.10); // 8% statt 10%
    }

    weekVol = clamp(weekVol, 5, maxCap);

    // Langer Lauf: 28–32% des Wochenvolumens
    const longRunMin = getLongRunMinKm(fitnesslevel);
    const longRunTarget = clamp(weekVol * 0.30, weekVol * 0.28, weekVol * 0.32);
    const max_long_run_km = round1(clamp(longRunTarget, longRunMin, weekVol * 0.32));

    const trainingstypen = buildTrainingTypesForWeek({
      phase,
      deload,
      trainingstageProWoche,
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

/**
 * Berechnet die benötigte Pace-Verbesserung pro Woche basierend auf Start- und Zielpace.
 */
export function calculatePaceImprovement({ zielpace, ziel_datum, start_datum }, avgPaceSec) {
  if (!zielpace || !ziel_datum) return null;

  const today = start_datum ? new Date(start_datum) : new Date();
  today.setHours(0, 0, 0, 0);

  const goalDate = new Date(ziel_datum);
  goalDate.setHours(0, 0, 0, 0);

  const diffDays = Math.max(0, Math.ceil((goalDate - today) / (24 * 60 * 60 * 1000)));
  const totalWeeks = Math.max(1, Math.ceil(diffDays / 7));

  // Zielpace (z.B. "5:30") parsen
  const parts = zielpace.split(":");
  if (parts.length < 2) return null;
  const targetPaceSec = parseInt(parts[0], 10) * 60 + (parseInt(parts[1], 10) || 0);

  if (!avgPaceSec || avgPaceSec <= 0) return null;

  const totalImprovementSec = avgPaceSec - targetPaceSec;
  const weeklyImprovementSec = totalImprovementSec > 0 ? (totalImprovementSec / totalWeeks) : 0;

  return {
    totalWeeks,
    targetPaceSec,
    avgPaceSec,
    totalImprovementSec: Math.max(0, totalImprovementSec),
    weeklyImprovementSec: Math.max(0, weeklyImprovementSec),
  };
}

/**
 * Gibt die berechneten Trainingspaces (in Sek/km) für eine bestimmte Woche zurück (lineare Anpassung).
 */
export function getAdjustedPacesForWeek(weekNum, totalWeeks, startPaceSec, targetPaceSec, trainingstyp) {
  if (!startPaceSec || !targetPaceSec) return null;

  // Linearer Fortschritt von Startpace zu Zielpace über die Wochen
  const progress = totalWeeks > 1 ? (weekNum - 1) / (totalWeeks - 1) : 1;
  const currentWeekBasePace = startPaceSec - progress * (startPaceSec - targetPaceSec);

  if (trainingstyp === "intervall") {
    // Intervalle auf die aktuelle Wochenzielpace anpassen
    return currentWeekBasePace;
  } else if (trainingstyp === "tempo") {
    // Tempolauf etwas langsamer (+15 Sekunden)
    return currentWeekBasePace + 15;
  } else {
    // Lockerer Lauf (+90 Sekunden)
    return currentWeekBasePace + 90;
  }
}

// ─────────────────────────────────────────────────────────────
// Schritt 5 – Dynamische Trainingsanpassung
// ─────────────────────────────────────────────────────────────

/**
 * Analysiert das Befinden der letzten Läufe und gibt Empfehlungen zurück.
 */
export function analyseBefinden(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return { avgBefinden: null, recommendation: "normal" };
  }

  const last3 = runs.slice(0, 3).filter(r => r?.befinden != null);
  if (last3.length === 0) {
    return { avgBefinden: null, recommendation: "normal" };
  }

  const avgBefinden = last3.reduce((sum, r) => sum + Number(r.befinden), 0) / last3.length;
  
  let recommendation = "normal";
  let volumeAdjustment = 0;
  let intensityAdjustment = "normal";

  if (avgBefinden >= 4.0) {
    recommendation = "increase";
    volumeAdjustment = 0.10; // +10% Volumen möglich
    intensityAdjustment = "upper_zone4";
  } else if (avgBefinden >= 3.0) {
    recommendation = "normal";
    volumeAdjustment = 0;
    intensityAdjustment = "mid_zone4";
  } else if (avgBefinden >= 2.0) {
    recommendation = "decrease";
    volumeAdjustment = -0.10; // -10% Volumen
    intensityAdjustment = "replace_with_tempo"; // Keine Intervalle
  } else {
    recommendation = "urgent_recovery";
    volumeAdjustment = -0.20; // -20% Volumen
    intensityAdjustment = "easy_only"; // Nur lockere Läufe
  }

  return {
    avgBefinden: round1(avgBefinden),
    recommendation,
    volumeAdjustment,
    intensityAdjustment,
    warning: avgBefinden < 2.5 ? "Nutzer benötigt Erholung - Warnung anzeigen" : null
  };
}

/**
 * Analysiert Herzfrequenz-Drift bei ähnlicher Pace.
 * Vergleicht HF der letzten 3 Läufe mit ähnlicher Pace.
 */
export function analyseHerzfrequenzDrift(runs) {
  if (!Array.isArray(runs) || runs.length < 2) {
    return { drift: null, trend: "insufficient_data" };
  }

  // Läufe mit Pace und HF filtern
  const validRuns = runs.filter(r => r?.pace && r?.herzfrequenz);
  if (validRuns.length < 2) {
    return { drift: null, trend: "insufficient_data" };
  }

  // Pace in Sekunden/km umwandeln für Vergleich
  const parsePace = (paceStr) => {
    const parts = paceStr.split(":");
    if (parts.length < 2) return null;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };

  const lastRun = validRuns[0];
  const prevRun = validRuns[1];

  const lastPaceSec = parsePace(lastRun.pace);
  const prevPaceSec = parsePace(prevRun.pace);

  if (!lastPaceSec || !prevPaceSec) {
    return { drift: null, trend: "invalid_pace_format" };
  }

  const paceDiff = Math.abs(lastPaceSec - prevPaceSec);
  const hfDiff = Number(lastRun.herzfrequenz) - Number(prevRun.herzfrequenz);

  // Nur analysieren wenn Pace ähnlich (±15 Sek/km)
  if (paceDiff > 15) {
    return { drift: null, trend: "pace_too_different" };
  }

  let trend = "stable";
  let recommendation = "normal";

  if (hfDiff >= 5) {
    trend = "increasing";
    recommendation = "reduce_volume"; // Übertraining-Risiko
  } else if (hfDiff <= -3) {
    trend = "decreasing";
    recommendation = "increase_pace"; // Fitnesszuwachs
  }

  return {
    drift: round1(hfDiff),
    trend,
    recommendation,
    lastRunHF: Number(lastRun.herzfrequenz),
    prevRunHF: Number(prevRun.herzfrequenz),
    paceDiff: round1(paceDiff)
  };
}

/**
 * Berechnet die Acute:Chronic Workload Ratio (ACWR).
 * acutLoad = Kilometervolumen letzte 7 Tage
 * chronicLoad = Gewichteter Durchschnitt der letzten 4 Wochen (neuere Wochen zählen mehr)
 */
export function berechneACWR(runs, currentDate = new Date()) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return { acwr: null, status: "insufficient_data" };
  }

  const jetzt = currentDate instanceof Date ? currentDate : new Date();

  // Acute Load: letzte 7 Tage
  const acuteRuns = runs.filter(r => {
    const diff = (jetzt - new Date(r.created_at)) / 86400000;
    return diff <= 7;
  });
  const acuteLoad = acuteRuns.reduce((s, r) => s + (r.distanz_km || 0), 0);

  // Chronic Load: Durchschnitt der letzten 4 Wochen
  // ABER: gewichtet - neuere Wochen zählen mehr
  const weekLoads = [0, 0, 0, 0];
  runs.forEach(r => {
    const diff = (jetzt - new Date(r.created_at)) / 86400000;
    if (diff <= 7) weekLoads[0] += r.distanz_km || 0;
    else if (diff <= 14) weekLoads[1] += r.distanz_km || 0;
    else if (diff <= 21) weekLoads[2] += r.distanz_km || 0;
    else if (diff <= 28) weekLoads[3] += r.distanz_km || 0;
  });

  // Gewichteter Durchschnitt (neuere Wochen = mehr Gewicht)
  const chronicLoad = (
    weekLoads[0] * 0.4 + 
    weekLoads[1] * 0.3 + 
    weekLoads[2] * 0.2 + 
    weekLoads[3] * 0.1
  );

  if (chronicLoad <= 0) {
    return { acwr: null, status: "no_chronic_data" };
  }

  const acwr = round1(acuteLoad / chronicLoad);

  let risiko = "niedrig";
  if (acwr > 1.5) {
    risiko = "hoch";
  } else if (acwr > 1.3) {
    risiko = "mittel";
  }

  return {
    acuteLoad: round1(acuteLoad),
    chronicLoad: round1(chronicLoad),
    acwr,
    risiko
  };
}

/**
 * Berechnet den Trimp Score (Training Impulse) für eine Einheit.
 * Vereinfachte Formel: Distanz * RPE
 */
export function berechneTrimpScore(distanzKm, rpe) {
  const dist = Number(distanzKm) || 0;
  const r = Number(rpe) || 3;
  return round1(dist * r);
}

/**
 * Berechnet den wöchentlichen Trimp Score aus einer Liste von Einheiten/Läufen.
 */
export function berechneWochenTrimp(einheiten) {
  if (!Array.isArray(einheiten) || einheiten.length === 0) {
    return { totalTrimp: 0, count: 0 };
  }

  let totalTrimp = 0;
  for (const einheit of einheiten) {
    const dist = Number(einheit.distanz_km) || 0;
    const rpe = Number(einheit.rpe) || 3;
    totalTrimp += dist * rpe;
  }

  return {
    totalTrimp: round1(totalTrimp),
    count: einheiten.length
  };
}

/**
 * Überprüft Progressive Overload: Steigerung max 10% pro Woche.
 */
export function ueberpruefeProgressiveOverload(aktuellerTrimp, vorherigerTrimp) {
  const current = Number(aktuellerTrimp) || 0;
  const previous = Number(vorherigerTrimp) || 0;

  if (previous === 0) {
    return { increase: 0, status: "baseline", withinLimit: true };
  }

  const increase = ((current - previous) / previous) * 100;
  const withinLimit = increase <= 10;

  return {
    increase: round1(increase),
    status: withinLimit ? "within_limit" : "exceeded",
    withinLimit,
    warning: !withinLimit ? "Steigerung > 10% - Verletzungsrisiko" : null
  };
}
