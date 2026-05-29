"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  User,
  Target,
  Calendar,
  Sparkles,
} from "lucide-react";

const TOTAL_STEPS = 8;

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
  { value: "5k", title: "5K verbessern" },
  { value: "10k", title: "10K laufen oder verbessern" },
  { value: "halbmarathon", title: "Halbmarathon" },
  { value: "marathon", title: "Marathon" },
  { value: "abnehmen", title: "Abnehmen durch Laufen" },
  { value: "gesund", title: "Gesund und fit bleiben" },
];

const initialForm = {
  vorname: "",
  geschlecht: "",
  alterJahre: "",
  gewichtKg: "",
  koerperfettanteil: "",
  stadtQuery: "",
  stadt: "",
  land: "",
  latitude: null,
  longitude: null,
  fitnesslevel: "",
  ziel: "",
  zielDatum: "",
  slots: Array.from({ length: 7 }, (_, i) => ({
    wochentag: i,
    verfuegbar: false,
    uhrzeit_start: "",
    uhrzeit_ende: "",
  })),
};

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

  const progress = (step / TOTAL_STEPS) * 100;

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

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
    switch (step) {
      case 1:
        if (!form.vorname.trim()) return "Bitte gib deinen Vornamen ein.";
        if (!form.geschlecht) return "Bitte wähle dein Geschlecht.";
        if (!form.alterJahre || Number(form.alterJahre) < 18 || Number(form.alterJahre) > 100) {
          return "Du musst mindestens 18 Jahre alt sein.";
        }
        if (!form.gewichtKg || Number(form.gewichtKg) < 30 || Number(form.gewichtKg) > 250) {
          return "Bitte gib ein realistisches Gewicht ein.";
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
        if (!form.zielDatum) return "Bitte wähle dein Zieldatum.";
        return null;
      case 6: {
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
          gewichtKg: form.gewichtKg,
          koerperfettanteil: form.koerperfettanteil || null,
          stadt: form.stadt,
          land: form.land,
          latitude: form.latitude,
          longitude: form.longitude,
          fitnesslevel: form.fitnesslevel,
          ziel: form.ziel,
          zielDatum: form.zielDatum,
          trainingstage: trainingstageValue,
          slots: availableSlots,
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                  Alter (Jahre)
                </span>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={form.alterJahre}
                  onChange={(e) => updateForm({ alterJahre: e.target.value })}
                  className="input-field"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                  Gewicht (kg)
                </span>
                <input
                  type="number"
                  min="30"
                  step="0.1"
                  value={form.gewichtKg}
                  onChange={(e) => updateForm({ gewichtKg: e.target.value })}
                  className="input-field"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-muted">
                Körperfettanteil ca. (%, optional)
              </span>
              <input
                type="number"
                min="3"
                max="60"
                step="0.1"
                value={form.koerperfettanteil}
                onChange={(e) =>
                  updateForm({ koerperfettanteil: e.target.value })
                }
                className="input-field"
                placeholder="optional"
              />
            </label>
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
            <div className="grid gap-3 sm:grid-cols-2">
              {ZIEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ ziel: opt.value })}
                  className={`rounded-md border p-5 text-left transition-all ${
                    form.ziel === opt.value
                      ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(230,50,40,0.2)]"
                      : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <p className="font-extrabold uppercase tracking-tight text-text">
                    {opt.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Calendar className="text-accent" size={22} />
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

      case 6: {
        const selectedCount = form.slots.filter((s) => s.verfuegbar).length;
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Calendar className="text-accent" size={22} />
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

      case 7:
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

      case 8:
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
