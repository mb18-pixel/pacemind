"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  User,
  Target,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";
import { createClient } from "@/lib/supabase/client";

const TOTAL_STEPS = 13;

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getMinDate() {
  const date = new Date();
  date.setDate(date.getDate() + 28); // 4 weeks
  return date.toISOString().split("T")[0];
}

function getMaxDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 2); // 2 years
  return date.toISOString().split("T")[0];
}

const GESCHLECHT_OPTIONS = [
  { value: "maennlich", label: "Männlich" },
  { value: "weiblich", label: "Weiblich" },
  { value: "divers", label: "Divers" },
];

const FITNESS_OPTIONS = [
  {
    value: "einsteiger",
    title: "Einsteiger",
    desc: "Ich laufe weniger als 6 Monate",
  },
  {
    value: "hobby",
    title: "Hobby",
    desc: "Ich laufe regelmäßig seit über 6 Monaten",
  },
  {
    value: "fortgeschritten",
    title: "Fortgeschritten",
    desc: "Ich laufe Wettkämpfe oder trainiere strukturiert",
  },
];

const ZIEL_OPTIONS = [
  { value: "5k", title: "5K", subtext: "5 km", category: "wettkampf" },
  { value: "10k", title: "10K", subtext: "10 km", category: "wettkampf" },
  { value: "halbmarathon", title: "Halbmarathon", subtext: "21,1 km", category: "wettkampf" },
  { value: "marathon", title: "Marathon", subtext: "42,2 km", category: "wettkampf" },
  { value: "ultramarathon", title: "Ultramarathon", subtext: "50km+", category: "wettkampf" },
  { value: "gesund bleiben", title: "Gesund bleiben", subtext: "Bewegung & Wohlbefinden", category: "gesundheit" },
  { value: "abnehmen", title: "Abnehmen", subtext: "Durch regelmäßiges Laufen", category: "gesundheit" },
  { value: "fit bleiben", title: "Fit bleiben", subtext: "Kondition aufbauen", category: "gesundheit" },
];

const initialForm = {
  vorname: "",
  geschlecht: "",
  alterJahre: "",
  koerperfettanteil: "",
  stadtQuery: "",
  stadt: "",
  land: "",
  latitude: null,
  longitude: null,
  fitnesslevel: "",
  ziel: "",
  zielDatum: "",
  zielPace: "",
  zielDistanz: "",
  zielzeit: "",
  aktuelleTrainingsfrequenz: "",
  aktuelleDistanz: "",
  referenzzeit: "",
  referenzdistanz: "5k",
  zielzeitBerechnet: false,
  slots: Array.from({ length: 7 }, (_, i) => ({
    wochentag: i,
    verfuegbar: false,
    uhrzeit_start: "",
    uhrzeit_ende: "",
  })),
};

const VDOT_MAPPING = {
  '5k': {
    28: '32:00', 32: '28:30', 35: '25:30',
    38: '23:30', 40: '22:30', 42: '21:30',
    46: '19:30', 50: '18:00', 55: '16:30', 60: '15:10'
  },
  '10k': {
    28: '1:08:00', 32: '59:30', 35: '54:00',
    38: '49:30', 40: '47:30', 42: '45:30',
    46: '42:00', 50: '38:30', 55: '35:30', 60: '32:30'
  },
  halbmarathon: {
    28: '2:35:00', 32: '2:16:00', 35: '2:03:00',
    38: '1:54:00', 40: '1:47:00', 42: '1:42:00',
    46: '1:34:00', 50: '1:27:00', 55: '1:20:00', 60: '1:13:00'
  },
  marathon: {
    28: '5:30:00', 32: '4:49:00', 35: '4:22:00',
    38: '4:00:00', 40: '3:49:00', 42: '3:38:00',
    46: '3:22:00', 50: '3:07:00', 55: '2:52:00', 60: '2:38:00'
  },
  ultramarathon: {
    28: '7:00:00', 32: '6:10:00', 35: '5:35:00',
    38: '5:10:00', 40: '4:55:00', 42: '4:40:00',
    46: '4:20:00', 50: '4:00:00', 55: '3:40:00', 60: '3:22:00'
  }
};

function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return 0;
}

function timeOfDayToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function getVdotFromReference(distanz, timeStr) {
  const mapping = VDOT_MAPPING[distanz];
  if (!mapping) return 35;
  const targetSecs = timeToSeconds(timeStr);
  if (targetSecs === 0) return 35;
  let closestVdot = 35;
  let minDiff = Infinity;
  for (const [vdotStr, tStr] of Object.entries(mapping)) {
    const diff = Math.abs(timeToSeconds(tStr) - targetSecs);
    if (diff < minDiff) {
      minDiff = diff;
      closestVdot = Number(vdotStr);
    }
  }
  return closestVdot;
}

function estimateVDOT(frequenz, fitness) {
  if (frequenz === "garnicht" || fitness === "einsteiger") return 28;
  if (frequenz === "5+" && fitness === "fortgeschritten") return 52;
  if (frequenz === "3-4" && fitness === "hobby") return 42;
  return 35; 
}

function calculateImprovement(weeks, currentVdot = 35) {
  // Base improvement based on time
  let baseImprovement;
  if (weeks <= 4) baseImprovement = 2;
  else if (weeks <= 8) baseImprovement = 4;
  else if (weeks <= 16) baseImprovement = 7;
  else baseImprovement = 10;

  // Adjust based on current fitness level
  // Lower VDOT (beginners) can improve more, higher VDOT (advanced) improve less
  // VDOT range: 28-60
  const vdotFactor = (60 - currentVdot) / (60 - 28); // 1.0 for beginners, 0.0 for elite
  const adjustedImprovement = baseImprovement * (0.5 + 0.5 * vdotFactor); // Min 50% of base

  return Math.round(adjustedImprovement);
}

function getZielzeit(vdot, distanz) {
  const distanzKey = distanz?.toLowerCase()
    .replace('halbmarathon', 'halbmarathon')
    .replace('marathon', 'marathon')
    .replace('5k', '5k')
    .replace('10k', '10k')
    .replace('ultramarathon', 'ultramarathon');
  
  const zeiten = VDOT_MAPPING[distanzKey];
  if (!zeiten) return null;
  
  // Finde nächsten VDOT-Wert
  const vdotWerte = Object.keys(zeiten).map(Number).sort((a,b) => a-b);
  const naechsterVdot = vdotWerte.reduce((prev, curr) => 
    Math.abs(curr - vdot) < Math.abs(prev - vdot) ? curr : prev
  );
  
  return zeiten[naechsterVdot];
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [slideDir, setSlideDir] = useState("forward");
  const [form, setForm] = useState(initialForm);
  const [suggestions, setSuggestions] = useState([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customGoalMode, setCustomGoalMode] = useState(false);
  const [customKfaMode, setCustomKfaMode] = useState(false);
  const [referenzzeitFehler, setReferenzzeitFehler] = useState("");
  const confettiTriggered = useRef(false);
  const minutenRef = useRef(null);
  const sekundenRef = useRef(null);
  const [minuten, setMinuten] = useState("");
  const [sekunden, setSekunden] = useState("");

  // Calculate total steps based on goal type
  const healthGoals = ["gesund bleiben", "abnehmen", "fit bleiben"];
  const totalSteps = healthGoals.includes(form.ziel) ? 7 : TOTAL_STEPS;
  const progress = (step / totalSteps) * 100;

  // Trigger confetti on welcome step
  useEffect(() => {
    if (step === totalSteps && !confettiTriggered.current) {
      confettiTriggered.current = true;
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#e63228', '#ffffff', '#ff6b6b'],
        disableForReducedMotion: true,
      });
    }
  }, [step, totalSteps]);

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    // Clear error when user starts typing
    setError(null);
  }, []);

  function validiereReferenzzeit(wert) {
    if (!wert || wert.trim() === '') return true; // optional
    
    // Erlaubte Formate: M:SS, MM:SS, H:MM:SS, HH:MM:SS
    const pattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
    return pattern.test(wert.trim());
  }

  function handleReferenzzeitChange(e) {
    const wert = e.target.value;
    updateForm({ referenzzeit: wert });
    
    if (wert && !validiereReferenzzeit(wert)) {
      setReferenzzeitFehler('Format: MM:SS (z.B. 25:30 für 5K)');
    } else {
      setReferenzzeitFehler('');
    }
  }

  function handleMinutenChange(e) {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setMinuten(value);
    
    // Auto-focus to seconds field after 2 digits
    if (value.length === 2) {
      sekundenRef.current?.focus();
    }
    
    updateReferenzzeit(value, sekunden);
  }

  function handleSekundenChange(e) {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setSekunden(value);
    updateReferenzzeit(minuten, value);
  }

  function updateReferenzzeit(min, sec) {
    if (!min && !sec) {
      updateForm({ referenzzeit: "" });
      setReferenzzeitFehler('');
      return;
    }
    
    const minStr = min.padStart(2, '0');
    const secStr = sec.padStart(2, '0');
    const wert = `${minStr}:${secStr}`;
    
    updateForm({ referenzzeit: wert });
    
    if (!validiereReferenzzeit(wert)) {
      setReferenzzeitFehler('Format: MM:SS (z.B. 25:30 für 5K)');
    } else {
      setReferenzzeitFehler('');
    }
  }

  // Clear minutes/seconds when leaving step 8
  useEffect(() => {
    if (step !== 8) {
      setMinuten('');
      setSekunden('');
    }
  }, [step]);

  useEffect(() => {
    if (step !== 2 || form.stadtQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingCity(true);
      try {
        const url = new URL(
          "https://geocoding-api.open-meteo.com/v1/search"
        );
        url.searchParams.set("name", form.stadtQuery.trim());
        url.searchParams.set("count", "5");
        url.searchParams.set("language", "de");

        const res = await fetch(url.toString());
        const data = await res.json();
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingCity(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.stadtQuery, step]);

  useEffect(() => {
    if (step !== 9 || customGoalMode) return;
    if (form.zielzeit && !form.zielzeitBerechnet) return; // Nutzer hat manuell editiert, nicht überschreiben

    let computedVdot = 35;
    if (form.referenzzeit) {
      computedVdot = getVdotFromReference(form.referenzdistanz, form.referenzzeit);
    } else {
      computedVdot = estimateVDOT(form.aktuelleTrainingsfrequenz, form.fitnesslevel);
    }

    let weeks = 8;
    if (form.zielDatum) {
      const diffTime = Math.abs(new Date(form.zielDatum) - new Date());
      weeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    }

    const improvement = calculateImprovement(weeks, computedVdot);
    const targetVdot = computedVdot + improvement;
    const goalDist = ["5k", "10k", "halbmarathon", "marathon"].includes(form.ziel)
      ? form.ziel
      : "5k";
    const calcTime = getZielzeit(targetVdot, goalDist);

    if (calcTime) {
      updateForm({ zielzeit: calcTime, zielzeitBerechnet: true });
    }
  }, [
    step,
    form.zielzeit,
    customGoalMode,
    form.referenzzeit,
    form.referenzdistanz,
    form.aktuelleTrainingsfrequenz,
    form.fitnesslevel,
    form.zielDatum,
    form.ziel,
    updateForm,
  ]);

  function selectCity(place) {
    const land =
      place.country || place.country_code || place.admin1 || "";
    updateForm({
      stadt: place.name,
      land,
      latitude: place.latitude,
      longitude: place.longitude,
      stadtQuery: `${place.name}${land ? `, ${land}` : ""}`,
    });
    setShowSuggestions(false);
    setSuggestions([]);
  }

  function getStepError() {
    const healthGoals = ["gesund bleiben", "abnehmen", "fit bleiben"];
    switch (step) {
      case 1:
        if (!form.vorname.trim()) return "Bitte gib deinen Vornamen ein.";
        if (!form.geschlecht) return "Bitte wähle dein Geschlecht.";
        if (!form.alterJahre || Number(form.alterJahre) < 18 || Number(form.alterJahre) > 100) {
          return "Du musst mindestens 18 Jahre alt sein.";
        }
        if (form.koerperfettanteil && (Number(form.koerperfettanteil) < 3 || Number(form.koerperfettanteil) > 60)) {
          return "Bitte gib einen realistischen Wert ein.";
        }
        return null;
      case 2:
        if (!form.stadt || form.latitude == null) {
          return "Bitte wähle eine Stadt aus der Liste.";
        }
        return null;
      case 3:
        if (!form.fitnesslevel) return "Bitte wähle dein Fitnesslevel.";
        return null;
      case 4:
        if (!form.ziel) return "Bitte wähle dein Ziel.";
        return null;
      case 5:
        // Skip validation for health goals
        if (!healthGoals.includes(form.ziel) && !form.zielDatum) {
          return "Bitte wähle dein Zieldatum.";
        }
        return null;
      case 6:
        if (!form.aktuelleTrainingsfrequenz) return "Bitte wähle deine Trainingsfrequenz.";
        return null;
      case 7:
        if (!form.aktuelleDistanz) return "Bitte wähle deine typische Distanz.";
        return null;
      case 8:
        if (referenzzeitFehler) {
          return referenzzeitFehler;
        }
        if (form.referenzzeit && !validiereReferenzzeit(form.referenzzeit)) {
          return "Bitte gib die Zeit im Format MM:SS oder HH:MM:SS ein.";
        }
        return null;
      case 9:
        // Skip validation for health goals
        if (!healthGoals.includes(form.ziel) && !form.zielzeit) {
          return "Bitte bestätige oder bearbeite deine Zielzeit.";
        }
        return null;
      case 10: {
        const activeSlots = form.slots.filter((s) => s.verfuegbar);
        if (activeSlots.length < 2) {
          return "Bitte wähle mindestens 2 Trainingstage";
        }
        for (const slot of activeSlots) {
          if (!slot.uhrzeit_start || !slot.uhrzeit_ende) {
            return "Bitte gib für jeden Trainingstag Uhrzeit von und bis an.";
          }
          if (slot.uhrzeit_start >= slot.uhrzeit_ende) {
            return "Die Endzeit muss nach der Startzeit liegen.";
          }
          const startMin = timeOfDayToMinutes(slot.uhrzeit_start);
          const endMin = timeOfDayToMinutes(slot.uhrzeit_ende);
          const durationMin = endMin - startMin;
          if (durationMin < 30) {
            return "Das Zeitfenster muss mindestens 30 Minuten betragen.";
          }
        }
        return null;
      }
      default:
        return null;
    }
  }

  function validateStep() {
    setError(null);
    return getStepError();
  }

  function isStepValid() {
    return getStepError() === null;
  }

  function goNext() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setSlideDir("forward");

    // Skip goal input steps for health goals
    const healthGoals = ["gesund bleiben", "abnehmen", "fit bleiben"];
    if (step === 4 && healthGoals.includes(form.ziel)) {
      // Skip to training times step (step 10)
      setStep(10);
      return;
    }

    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setError(null);
    setSlideDir("back");
    setStep((s) => Math.max(s - 1, 1));
  }

  async function finishOnboarding() {
    setSaving(true);
    setError(null);
    try {
      const availableSlots = form.slots.filter((s) => s.verfuegbar);
      const trainingstageValue = availableSlots.length;

      // Save referenzzeit to appropriate field based on goal
      let referenzzeit_5k = null;
      let referenzzeit_10k = null;
      
      if (form.referenzzeit) {
        if (form.ziel === "10k") {
          referenzzeit_10k = form.referenzzeit;
        } else {
          referenzzeit_5k = form.referenzzeit;
        }
      }

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          vorname: form.vorname,
          geschlecht: form.geschlecht,
          alterJahre: form.alterJahre,
          koerperfettanteil: form.koerperfettanteil || null,
          stadt: form.stadt,
          land: form.land,
          latitude: form.latitude,
          longitude: form.longitude,
          fitnesslevel: form.fitnesslevel,
          ziel: form.ziel,
          zielDatum: form.zielDatum || null,
          zielPace: form.zielPace || null,
          zielDistanz: form.zielDistanz || null,
          zielzeit: form.zielzeit || null,
          aktuelleTrainingsfrequenz: form.aktuelleTrainingsfrequenz || null,
          aktuelleDistanz: form.aktuelleDistanz || null,
          zielzeitBerechnet: form.zielzeitBerechnet,
          trainingstage: trainingstageValue,
          slots: availableSlots,
          referenzzeit_5k: referenzzeit_5k,
          referenzzeit_10k: referenzzeit_10k,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Ungültige Server-Antwort. Bitte erneut versuchen.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");

      setSaving(false);
      setStep(totalSteps); // Move to welcome step with confetti
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleTrainingStarten() {
    console.log('Onboarding Daten:', form);
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('Kein User gefunden');
      return;
    }

    // Map referenzzeit to the correct field based on referenzdistanz
    let referenzzeit_5k = null;
    let referenzzeit_10k = null;
    if (form.referenzdistanz === '5k' && form.referenzzeit) {
      referenzzeit_5k = form.referenzzeit;
    } else if (form.referenzdistanz === '10k' && form.referenzzeit) {
      referenzzeit_10k = form.referenzzeit;
    }

    // Alle Onboarding-Daten auf einmal speichern:
    const { error } = await supabase
      .from('profiles')
      .update({
        vorname: form.vorname || null,
        geschlecht: form.geschlecht || null,
        alter_jahre: form.alterJahre ? parseInt(form.alterJahre) : null,
        koerperfettanteil: form.koerperfettanteil 
          ? parseFloat(form.koerperfettanteil) : null,
        fitnesslevel: form.fitnesslevel || null,
        hauptziel: form.ziel || null,
        ziel_datum: form.zielDatum || null,
        zielzeit: form.zielzeit || null,
        zielpace: form.zielPace || null,
        zieldistanz: form.zielDistanz || null,
        aktuelle_trainingsfrequenz: form.aktuelleTrainingsfrequenz || null,
        aktuelle_distanz: form.aktuelleDistanz || null,
        referenzzeit_5k: referenzzeit_5k || null,
        referenzzeit_10k: referenzzeit_10k || null,
        stadt: form.stadt || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        trainingstage: form.slots ? form.slots.filter(s => s.verfuegbar).length : null,
        onboarding_abgeschlossen: true,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Supabase Error:', error);
      alert('Fehler beim Speichern. Bitte versuche es erneut.');
      return;
    }

    console.log('Profil gespeichert:', form);
    
    // Zeitslots separat speichern:
    const verfuegbareSlots = form.slots.filter(s => s.verfuegbar && s.uhrzeit_start && s.uhrzeit_ende);
    if (verfuegbareSlots.length > 0) {
      // Erst alle alten Slots löschen:
      await supabase
        .from('training_slots')
        .delete()
        .eq('user_id', user.id);
      
      // Neue Slots einfügen:
      const slotData = verfuegbareSlots.map(slot => ({
        user_id: user.id,
        wochentag: slot.wochentag,
        wochentag_name: WOCHENTAGE[slot.wochentag],
        verfuegbar: true,
        uhrzeit_start: slot.uhrzeit_start,
        uhrzeit_ende: slot.uhrzeit_ende
      }));
      
      const { error: slotsError } = await supabase
        .from('training_slots')
        .insert(slotData);
      
      if (slotsError) {
        console.error('Fehler beim Speichern der Zeitslots:', slotsError);
      }
    }

    // Zur Chat-Seite navigieren:
    router.push('/chat');
    router.refresh();
  }

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <User className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Persönliche Daten
              </h2>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                Vorname
              </span>
              <input
                type="text"
                value={form.vorname}
                onChange={(e) => updateForm({ vorname: e.target.value })}
                className="input-field"
                placeholder="Max"
              />
            </label>
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                Geschlecht
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {GESCHLECHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateForm({ geschlecht: opt.value })}
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      cursor: 'pointer'
                    }}
                    className={`rounded-md border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all ${
                      form.geschlecht === opt.value
                        ? "border-accent bg-accent/15 text-text shadow-[0_0_16px_rgba(230,50,40,0.25)]"
                        : "border-border bg-surface text-text-muted hover:border-accent/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-1">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                  Alter (Jahre)
                </span>
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={form.alterJahre}
                  onChange={(e) => updateForm({ alterJahre: e.target.value })}
                  className="input-field"
                />
              </label>
            </div>
            
            <div className="pt-2">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                Körperfettanteil (optional)
              </span>
              <p className="mb-4 text-xs text-text-muted">
                Keine exakte Messung nötig – wähle was am besten passt. Hilft uns bei der Trainingsintensität.
              </p>
              
              {!customKfaMode ? (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                  {[
                    { id: 1, title: "Sehr schlank", sub: "Rippen/Adern sichtbar", valM: 7, valF: 15, txtM: "6–9%", txtF: "14–17%" },
                    { id: 2, title: "Schlank / Athletisch", sub: "Bauchmuskeln sichtbar", valM: 12, valF: 20, txtM: "10–14%", txtF: "18–22%" },
                    { id: 3, title: "Fit", sub: "Definierter Körperbau", valM: 17, valF: 25, txtM: "15–19%", txtF: "23–27%" },
                    { id: 4, title: "Durchschnittlich", sub: "Leichte Fettpolster", valM: 22, valF: 30, txtM: "20–24%", txtF: "28–32%" },
                    { id: 5, title: "Über Durchschnitt", sub: "Deutliche Fettpolster", valM: 27, valF: 35, txtM: "25–29%", txtF: "33–37%" },
                    { id: 6, title: "Übergewichtig", sub: "Deutliches Übergewicht", valM: 32, valF: 40, txtM: "30%+", txtF: "38%+" },
                  ].map((card) => {
                    const isM = form.geschlecht === "maennlich";
                    const isF = form.geschlecht === "weiblich";
                    const isD = form.geschlecht === "divers" || !form.geschlecht;
                    
                    const displayTxt = isD ? `M: ${card.txtM} | F: ${card.txtF}` : isM ? card.txtM : card.txtF;
                    const valToSet = isD ? Math.round((card.valM + card.valF) / 2) : isM ? card.valM : card.valF;
                    const isSelected = Number(form.koerperfettanteil) === valToSet;

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => updateForm({ koerperfettanteil: valToSet })}
                        style={{
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                          cursor: 'pointer'
                        }}
                        className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                          isSelected
                            ? "border-accent bg-accent/15 text-text shadow-[0_0_12px_rgba(230,50,40,0.25)]"
                            : "border-border bg-surface hover:border-accent/50"
                        }`}
                      >
                        <User className={isSelected ? "text-accent mb-2" : "text-text-muted mb-2"} size={24} />
                        <span className="text-xs font-bold uppercase tracking-tight">{card.title}</span>
                        <span className="mt-1 text-[10px] text-text-muted leading-tight">{card.sub}</span>
                        <span className="mt-2 text-xs font-black text-white bg-bg px-2 py-0.5 rounded-md border border-border">
                          {displayTxt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <label className="block max-w-xs">
                  <input
                    type="number"
                    min="3"
                    max="60"
                    step="0.1"
                    value={form.koerperfettanteil}
                    onChange={(e) => updateForm({ koerperfettanteil: e.target.value })}
                    className="input-field"
                    placeholder="z.B. 15.5"
                    autoFocus
                  />
                </label>
              )}
              
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomKfaMode(!customKfaMode);
                    if (customKfaMode) updateForm({ koerperfettanteil: "" });
                  }}
                  style={{
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {customKfaMode ? "← Zurück zur visuellen Auswahl" : "Ich weiß es genau (Manuelle Eingabe)"}
                </button>
                {!customKfaMode && form.koerperfettanteil && (
                  <>
                    <span className="text-text-muted text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => updateForm({ koerperfettanteil: "" })}
                      style={{
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        cursor: 'pointer'
                      }}
                      className="text-xs font-semibold text-text-muted hover:text-white"
                    >
                      Auswahl aufheben
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <MapPin className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Standort
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Dein Standort hilft uns, das aktuelle Wetter für deine Laufplanung
              einzubeziehen – z. B. Regen, Kälte oder Hitze bei der
              Trainingsempfehlung.
            </p>
            <label className="relative block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                Stadt
              </span>
              <input
                type="text"
                value={form.stadtQuery}
                onChange={(e) => {
                  updateForm({
                    stadtQuery: e.target.value,
                    stadt: "",
                    land: "",
                    latitude: null,
                    longitude: null,
                  });
                }}
                onFocus={() => suggestions.length && setShowSuggestions(true)}
                className="input-field"
                placeholder="z. B. München"
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-surface-elevated shadow-lg" style={{ zIndex: 10 }}>
                  {suggestions.map((place) => (
                    <li key={`${place.id}-${place.latitude}`}>
                      <button
                        type="button"
                        onClick={() => selectCity(place)}
                        style={{
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                          cursor: 'pointer'
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-text transition-colors hover:bg-accent/10"
                      >
                        <span className="font-semibold">{place.name}</span>
                        {place.admin1 && (
                          <span className="text-text-muted">
                            , {place.admin1}
                          </span>
                        )}
                        {place.country && (
                          <span className="block text-xs text-text-muted">
                            {place.country}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchingCity && (
                <p className="mt-2 text-xs text-text-muted">Suche …</p>
              )}
              {form.stadt && form.latitude != null && (
                <p className="mt-2 text-xs font-semibold text-accent">
                  Ausgewählt: {form.stadt}
                  {form.land ? `, ${form.land}` : ""}
                </p>
              )}
            </label>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Target className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Fitnesslevel
              </h2>
            </div>
            <div className="space-y-3">
              {FITNESS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ fitnesslevel: opt.value })}
                  style={{
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  className={`w-full rounded-md border p-5 text-left transition-all duration-200 ${
                    form.fitnesslevel === opt.value
                      ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(230,50,40,0.3)] scale-[1.02]"
                      : "border-border bg-surface hover:border-accent/40 hover:shadow-[0_0_15px_rgba(230,50,40,0.15)] hover:scale-[1.01] active:scale-[0.98]"
                  }`}
                >
                  <p className="font-extrabold uppercase tracking-tight text-text">
                    {opt.title}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Target className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Dein Ziel
              </h2>
            </div>
            
            {/* Wettkampf-Ziele */}
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-accent">
                WETTKAMPF
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ZIEL_OPTIONS.filter(opt => opt.category === "wettkampf").map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateForm({ ziel: opt.value })}
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      cursor: 'pointer'
                    }}
                    className={`rounded-md border p-4 text-left transition-all duration-200 ${
                      form.ziel === opt.value
                        ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(230,50,40,0.3)] scale-[1.02]"
                        : "border-border bg-surface hover:border-accent/40 hover:shadow-[0_0_15px_rgba(230,50,40,0.15)] hover:scale-[1.01] active:scale-[0.98]"
                    }`}
                  >
                    <p className="font-extrabold uppercase tracking-tight text-text">
                      {opt.title}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {opt.subtext}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Rote Trennlinie */}
            <div className="h-px bg-gradient-to-r from-transparent via-accent to-transparent" />

            {/* Gesundheits- & Fitnessziele */}
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-accent">
                GESUNDHEIT & FITNESS
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {ZIEL_OPTIONS.filter(opt => opt.category === "gesundheit").map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateForm({ ziel: opt.value })}
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      cursor: 'pointer'
                    }}
                    className={`rounded-md border p-4 text-left transition-all duration-200 ${
                      form.ziel === opt.value
                        ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(230,50,40,0.3)] scale-[1.02]"
                        : "border-border bg-surface hover:border-accent/40 hover:shadow-[0_0_15px_rgba(230,50,40,0.15)] hover:scale-[1.01] active:scale-[0.98]"
                    }`}
                  >
                    <p className="font-extrabold uppercase tracking-tight text-text">
                      {opt.title}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {opt.subtext}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Target className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Zieldatum
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Wann möchtest du dein Ziel erreichen?
            </p>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                Datum
              </span>
              <input
                type="date"
                min={getMinDate()}
                max={getMaxDate()}
                value={form.zielDatum}
                onChange={(e) => updateForm({ zielDatum: e.target.value })}
                className="input-field"
              />
            </label>
          </div>
        );

      case 6:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Target className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Trainingsfrequenz
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Wie oft läufst du aktuell?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: "garnicht", label: "Gar nicht" },
                { value: "1-2", label: "1-2x / Woche" },
                { value: "3-4", label: "3-4x / Woche" },
                { value: "5+", label: "5x+ / Woche" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ aktuelleTrainingsfrequenz: opt.value })}
                  style={{
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  className={`rounded-md border p-4 text-center font-bold uppercase tracking-wide transition-all ${
                    form.aktuelleTrainingsfrequenz === opt.value
                      ? "border-accent bg-accent/15 text-text shadow-[0_0_16px_rgba(230,50,40,0.25)]"
                      : "border-border bg-surface text-text-muted hover:border-accent/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Target className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Aktuelle Distanz
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Wie weit läufst du typischerweise?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: "unter3", label: "Unter 3km" },
                { value: "3-5", label: "3-5km" },
                { value: "5-10", label: "5-10km" },
                { value: "ueber10", label: "Über 10km" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ aktuelleDistanz: opt.value })}
                  style={{
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  className={`rounded-md border p-4 text-center font-bold uppercase tracking-wide transition-all ${
                    form.aktuelleDistanz === opt.value
                      ? "border-accent bg-accent/15 text-text shadow-[0_0_16px_rgba(230,50,40,0.25)]"
                      : "border-border bg-surface text-text-muted hover:border-accent/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Target className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Referenzzeit (optional)
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Hast du eine aktuelle Bestzeit über 5K oder 10K? Dies hilft uns, dein Ziel noch genauer zu berechnen.
            </p>
            <div className="flex gap-2">
              <select
                value={form.referenzdistanz}
                onChange={(e) => updateForm({ referenzdistanz: e.target.value })}
                className="input-field w-32"
              >
                <option value="5k">5K</option>
                <option value="10k">10K</option>
              </select>
              <div className="flex items-center gap-1">
                <input
                  key="minuten-input"
                  ref={minutenRef}
                  type="tel"
                  inputMode="numeric"
                  value={minuten}
                  onChange={handleMinutenChange}
                  placeholder="MM"
                  maxLength={2}
                  autoComplete="off"
                  className="input-field w-16 text-base"
                  style={{ fontSize: '16px' }}
                />
                <span className="text-text font-bold text-base">:</span>
                <input
                  key="sekunden-input"
                  ref={sekundenRef}
                  type="tel"
                  inputMode="numeric"
                  value={sekunden}
                  onChange={handleSekundenChange}
                  placeholder="SS"
                  maxLength={2}
                  autoComplete="off"
                  className="input-field w-16 text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
            {referenzzeitFehler && (
              <p style={{ color: '#e63228', fontSize: '12px', marginTop: '6px' }}>
                {referenzzeitFehler}
              </p>
            )}
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  updateForm({ referenzzeit: "" });
                  setReferenzzeitFehler("");
                  goNext();
                }}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  cursor: 'pointer'
                }}
                className="btn-secondary w-full"
              >
                Keine Referenzzeit (Überspringen)
              </button>
            </div>
          </div>
        );

      case 9: {
        // Calculate only if not already manually edited or we don't have one
        let computedVdot = 35;
        if (form.referenzzeit) {
          computedVdot = getVdotFromReference(form.referenzdistanz, form.referenzzeit);
        } else {
          computedVdot = estimateVDOT(form.aktuelleTrainingsfrequenz, form.fitnesslevel);
        }

        // Weeks until goal
        let weeks = 8;
        if (form.zielDatum) {
          const diffTime = Math.abs(new Date(form.zielDatum) - new Date());
          weeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        }
        
        const improvement = calculateImprovement(weeks, computedVdot);
        const targetVdot = computedVdot + improvement;
        
        // Ensure we calculate time based on goal if it matches
        const goalDist = ["5k", "10k", "halbmarathon", "marathon"].includes(form.ziel) ? form.ziel : "5k";
        let calcTime = getZielzeit(targetVdot, goalDist);

        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Sparkles className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Realistisches Ziel
              </h2>
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center shadow-lg">
              <p className="text-sm font-bold uppercase tracking-widest text-text-muted mb-2">
                Realistische Zielzeit für {goalDist === '5k' ? '5K' : goalDist === '10k' ? '10K' : goalDist.charAt(0).toUpperCase() + goalDist.slice(1)}:
              </p>
              {customGoalMode ? (
                <input
                  type="text"
                  value={form.zielzeit}
                  onChange={(e) => updateForm({ zielzeit: e.target.value, zielzeitBerechnet: false })}
                  className="input-field text-center text-2xl font-black mb-4"
                  placeholder="MM:SS oder HH:MM:SS"
                  autoFocus
                />
              ) : (
                <div className="text-4xl font-black text-white mb-6">
                  🎯 {form.zielzeit || calcTime}
                </div>
              )}

              {!customGoalMode && (
                <div className="space-y-2 text-sm text-text-muted">
                  <p>→ Benötigte Verbesserung: <span className="font-bold text-accent">+{improvement} VDOT</span> in {weeks} Wochen</p>
                  <p className="text-accent font-semibold mt-2">Ehrgeizig, aber erreichbar 🚀</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              {!customGoalMode && (
                <button
                  type="button"
                  onClick={() => setCustomGoalMode(true)}
                  style={{
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  className="btn-secondary flex-1"
                >
                  Eigene Zeit eingeben
                </button>
              )}
            </div>
          </div>
        );
      }

      case 10: {
        const selectedCount = form.slots.filter((s) => s.verfuegbar).length;
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Target className="text-accent" size={22} />
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
                Wann kannst du trainieren?
              </h2>
            </div>
            <p className="text-sm text-text-muted">
              Wähle mindestens 2 Trainingstage und gib dein Zeitfenster an.
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-accent">
              {selectedCount} Trainingstage ausgewählt
            </p>
            <div className="divide-y divide-border rounded-md border border-border bg-surface">
              {WOCHENTAGE.map((tag, index) => (
                <div
                  key={tag}
                  className={`p-4 transition-colors ${
                    form.slots[index].verfuegbar ? "bg-surface-elevated/50" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex w-full items-center justify-between sm:w-28 sm:justify-start sm:gap-4">
                      <span className="w-8 text-sm font-extrabold uppercase text-text">
                        {tag}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.slots[index].verfuegbar}
                        onClick={() => {
                          const newSlots = [...form.slots];
                          const next = !newSlots[index].verfuegbar;
                          newSlots[index] = {
                            ...newSlots[index],
                            verfuegbar: next,
                            uhrzeit_start: next
                              ? newSlots[index].uhrzeit_start || "07:00"
                              : "",
                            uhrzeit_ende: next
                              ? newSlots[index].uhrzeit_ende || "08:00"
                              : "",
                          };
                          updateForm({ slots: newSlots });
                        }}
                        style={{
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                          cursor: 'pointer'
                        }}
                        className={`relative h-7 w-12 rounded-md border transition-all ${
                          form.slots[index].verfuegbar
                            ? "border-accent bg-accent"
                            : "border-border bg-bg"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-sm bg-white transition-all ${
                            form.slots[index].verfuegbar
                              ? "left-[calc(100%-1.375rem)]"
                              : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                    {form.slots[index].verfuegbar && (
                      <div className="flex flex-1 flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold uppercase text-text-muted">
                            Von
                          </label>
                          <input
                            key={`start-${index}-${form.slots[index].verfuegbar}`}
                            type="time"
                            value={form.slots[index].uhrzeit_start}
                            onChange={(e) => {
                              const newSlots = [...form.slots];
                              newSlots[index] = {
                                ...newSlots[index],
                                uhrzeit_start: e.target.value,
                              };
                              updateForm({ slots: newSlots });
                            }}
                            className="input-field w-auto text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold uppercase text-text-muted">
                            Bis
                          </label>
                          <input
                            key={`end-${index}-${form.slots[index].verfuegbar}`}
                            type="time"
                            value={form.slots[index].uhrzeit_ende}
                            onChange={(e) => {
                              const newSlots = [...form.slots];
                              newSlots[index] = {
                                ...newSlots[index],
                                uhrzeit_ende: e.target.value,
                              };
                              updateForm({ slots: newSlots });
                            }}
                            className="input-field w-auto text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 11:
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-accent/15 shadow-[0_0_40px_rgba(230,50,40,0.3)]">
              <Sparkles size={40} className="text-accent animate-pulse" strokeWidth={2} />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-accent">
              PerformanceProtokoll
            </p>
            <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
              Dein Plan wird erstellt...
            </h2>
            <p className="mt-4 text-lg text-text-muted">
              Dein Coach erstellt deinen persönlichen Trainingsplan.
            </p>
          </div>
        );

      case 12:
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/20 shadow-[0_0_60px_rgba(230,50,40,0.4)] animate-pulse">
              <Sparkles size={48} className="text-accent" strokeWidth={2.5} />
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-widest text-accent">
              PerformanceProtokoll
            </p>
            <h1 className="mt-4 text-4xl font-black uppercase tracking-tight text-white sm:text-5xl md:text-6xl">
              Willkommen, {form.vorname}!
            </h1>
            <p className="mt-6 text-xl text-text-muted">
              Dein Coach ist bereit.
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <div className="h-1 w-full bg-surface">
        <div
          className="h-full bg-accent transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 pb-32">
        <div
          key={step}
          className={
            slideDir === "forward"
              ? "animate-slide-forward mt-6 flex-1"
              : "animate-slide-back mt-6 flex-1"
          }
        >
          {renderStep()}
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="fixed bottom-0 left-0 right-0 mt-8 flex items-center justify-between gap-4 bg-bg py-4 border-t border-border/30 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ zIndex: 50 }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', pointerEvents: 'auto' }}
              className="flex items-center gap-2 rounded-md border border-border bg-transparent px-6 py-3 text-sm font-bold uppercase tracking-wide text-text transition-all duration-200 hover:border-accent hover:text-white active:scale-[0.98]"
            >
              <ArrowLeft size={18} />
              Zurück
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/')}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', pointerEvents: 'auto' }}
              className="flex items-center gap-2 rounded-md border border-border bg-transparent px-6 py-3 text-sm font-bold uppercase tracking-wide text-text transition-all duration-200 hover:border-accent hover:text-white active:scale-[0.98]"
            >
              <ArrowLeft size={18} />
              Zurück
            </button>
          )}

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => goNext()}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto',
              }}
              className={`ml-auto flex items-center gap-2 rounded-md px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
                isStepValid()
                  ? "bg-accent text-white hover:shadow-[0_0_20px_rgba(230,50,40,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-[#333] text-[#666] cursor-not-allowed opacity-50"
              }`}
            >
              Weiter
              <ArrowRight size={18} />
            </button>
          ) : step === totalSteps ? (
            <button
              type="button"
              onClick={handleTrainingStarten}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="btn-primary ml-auto flex items-center gap-2"
            >
              Training starten →
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finishOnboarding}
              disabled={saving}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="btn-primary ml-auto flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Speichern …
                </>
              ) : (
                <>
                  Training starten
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
