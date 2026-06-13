"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  User,
  Target,
  Sparkles,
} from "lucide-react";

const TOTAL_STEPS = 12;

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
  { value: "5k", title: "5K", subtext: "3,1 km", category: "wettkampf" },
  { value: "10k", title: "10K", subtext: "6,2 km", category: "wettkampf" },
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
  marathon: {
    28: "5:30:00", 35: "4:22:00", 40: "3:49:00", 42: "3:38:00", 46: "3:22:00", 50: "3:07:00", 55: "2:52:00", 60: "2:38:00"
  },
  halbmarathon: {
    28: "2:35:00", 35: "2:03:00", 40: "1:47:00", 42: "1:42:00", 46: "1:34:00", 50: "1:27:00"
  },
  "10k": {
    28: "1:08:00", 35: "54:00", 40: "47:30", 42: "45:30", 46: "42:00", 50: "38:30"
  },
  "5k": {
    28: "32:00", 35: "25:30", 40: "22:30", 42: "21:30", 46: "19:30", 50: "18:00"
  }
};

function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return 0;
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

function calculateImprovement(weeks) {
  if (weeks <= 4) return 2;
  if (weeks <= 8) return 4;
  if (weeks <= 16) return 7;
  return 10;
}

function getZielzeit(vdot, ziel) {
  const mapping = VDOT_MAPPING[ziel];
  if (!mapping) return null;
  const keys = Object.keys(mapping).map(Number).sort((a,b) => a-b);
  let closest = keys[0];
  for (let k of keys) {
    if (Math.abs(k - vdot) < Math.abs(closest - vdot)) closest = k;
  }
  return mapping[closest];
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

  const progress = (step / TOTAL_STEPS) * 100;

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
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

  function validateStep() {
    setError(null);
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
        }
        return null;
      }
      default:
        return null;
    }
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

      router.push("/chat");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-surface-elevated shadow-lg">
                  {suggestions.map((place) => (
                    <li key={`${place.id}-${place.latitude}`}>
                      <button
                        type="button"
                        onClick={() => selectCity(place)}
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
                  className={`w-full rounded-md border p-5 text-left transition-all ${
                    form.fitnesslevel === opt.value
                      ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(230,50,40,0.2)]"
                      : "border-border bg-surface hover:border-accent/40"
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
                    className={`rounded-md border p-4 text-left transition-all ${
                      form.ziel === opt.value
                        ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(230,50,40,0.2)]"
                        : "border-border bg-surface hover:border-accent/40"
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
                    className={`rounded-md border p-4 text-left transition-all ${
                      form.ziel === opt.value
                        ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(230,50,40,0.2)]"
                        : "border-border bg-surface hover:border-accent/40"
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
              <input
                type="text"
                value={form.referenzzeit}
                onChange={handleReferenzzeitChange}
                placeholder="z.B. 25:30"
                inputMode="numeric"
                autoComplete="off"
                className="input-field flex-1"
              />
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
        
        const improvement = calculateImprovement(weeks);
        const targetVdot = computedVdot + improvement;
        
        // Ensure we calculate time based on goal if it matches
        const goalDist = ["5k", "10k", "halbmarathon", "marathon"].includes(form.ziel) ? form.ziel : "5k";
        let calcTime = getZielzeit(targetVdot, goalDist);
        
        // Init target time only if not set
        if (!form.zielzeit && calcTime && !customGoalMode) {
          setTimeout(() => updateForm({ zielzeit: calcTime, zielzeitBerechnet: true }), 0);
        }

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
                Berechnete Zielzeit ({goalDist})
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
                  {form.zielzeit || calcTime}
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
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-accent/15 shadow-[0_0_40px_rgba(230,50,40,0.3)]">
              <Sparkles size={40} className="text-accent" strokeWidth={2} />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-accent">
              PerformanceProtokoll
            </p>
            <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
              Willkommen, {form.vorname}!
            </h2>
            <p className="mt-4 text-lg text-text-muted">
              Dein Coach ist bereit.
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      <div className="h-1 w-full bg-surface">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
          Schritt {step} von {TOTAL_STEPS}
        </p>

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

        <div className="mt-8 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              Zurück
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              className="btn-primary ml-auto flex items-center gap-2"
            >
              Weiter
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finishOnboarding}
              disabled={saving}
              className="btn-primary ml-auto flex items-center gap-2"
            >
              {saving ? "Speichern …" : "Training starten"}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
