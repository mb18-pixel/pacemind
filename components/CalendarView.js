"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  RefreshCw,
} from "lucide-react";
import { PLAN_UPDATED_EVENT } from "@/components/ChatInterface";
import { weatherEmoji } from "@/lib/weather";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TRAINING_COLORS = {
  intervall: "border-red-500 bg-red-500/10",
  tempo: "border-orange-500 bg-orange-500/10",
  locker: "border-green-500 bg-green-500/10",
  pause: "border-gray-500 bg-gray-500/10",
  langlauf: "border-blue-500 bg-blue-500/10",
};

const STATUS_COLORS = {
  geplant: "text-text-muted",
  abgeschlossen: "text-green-400",
  uebersprungen: "text-red-400",
};

export default function CalendarView() {
  const [plan, setPlan] = useState([]);
  const [slots, setSlots] = useState([]);
  const [weatherByDate, setWeatherByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingSlots, setSavingSlots] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [activeTab, setActiveTab] = useState("this"); // this | next
  const [weekOffset, setWeekOffset] = useState(0); // 0 = diese Woche (Mo), 1 = nächste Woche (Mo)
  const [spontaneousOpen, setSpontaneousOpen] = useState(false);
  const [spontaneousSaving, setSpontaneousSaving] = useState(false);
  const [spontaneousDraft, setSpontaneousDraft] = useState({
    id: null,
    datum: "",
    trainingstyp: "locker",
    uhrzeit_start: "",
    uhrzeit_ende: "",
    dauer_minuten: "",
  });

  function getCurrentWeekStart() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return start;
  }

  function getWeekStartByOffset(offset) {
    const base = getCurrentWeekStart();
    const d = new Date(base);
    d.setDate(d.getDate() + offset * 7);
    return d;
  }

  function formatISO(date) {
    return date.toISOString().split("T")[0];
  }

  function getISOWeekNumber(date) {
    // ISO week date weeks start on Monday
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  const selectedWeekStart = getWeekStartByOffset(weekOffset);
  const selectedWeekStartIso = formatISO(selectedWeekStart);

  useEffect(() => {
    // Tabs sind eine einfache Abkürzung: 0 => diese Woche, >=1 => nächste Woche
    Promise.resolve().then(() => {
      setActiveTab(weekOffset >= 1 ? "next" : "this");
    });
  }, [weekOffset]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, slotsRes, weatherRes] = await Promise.all([
        fetch(`/api/training-plan?start=${selectedWeekStartIso}&days=7`),
        fetch("/api/training-slots"),
        // Open-Meteo liefert i.d.R. max. 16 Tage – reicht für „Nächste Woche“
        fetch("/api/weather?days=16"),
      ]);

      const planData = await planRes.json();
      const slotsData = await slotsRes.json();

      if (planData.plan) setPlan(planData.plan);
      if (slotsData.slots) setSlots(slotsData.slots);

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        const map = {};
        (weatherData.forecast || []).forEach((d) => {
          map[d.date] = d;
        });
        setWeatherByDate(map);
      }
    } catch (error) {
      console.error("Error loading calendar data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedWeekStartIso]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [weekOffset, loadData]);

  useEffect(() => {
    function onPlanUpdated() {
      loadData();
    }
    window.addEventListener(PLAN_UPDATED_EVENT, onPlanUpdated);
    return () => window.removeEventListener(PLAN_UPDATED_EVENT, onPlanUpdated);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function saveSlots() {
    setSavingSlots(true);
    try {
      const res = await fetch("/api/training-slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      await loadData();
      window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
    } catch (error) {
      console.error("Error saving slots:", error);
      alert(error.message);
    } finally {
      setSavingSlots(false);
    }
  }

  async function updatePlanEntry(id, updates) {
    try {
      const res = await fetch("/api/training-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      await loadData();
    } catch (error) {
      console.error("Error updating plan entry:", error);
    }
  }

  async function generateNewPlan() {
    setGeneratingPlan(true);
    try {
      const res = await fetch("/api/training-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, days: 14 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generierung fehlgeschlagen");
      await loadData();
      window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
    } catch (error) {
      console.error("Error generating plan:", error);
      alert(error.message);
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function generatePlanForSelectedWeek() {
    setGeneratingPlan(true);
    try {
      const res = await fetch("/api/training-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generate: true,
          days: 7,
          start: selectedWeekStartIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generierung fehlgeschlagen");
      await loadData();
      window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
    } catch (error) {
      console.error("Error generating selected week plan:", error);
      alert(error.message);
    } finally {
      setGeneratingPlan(false);
    }
  }

  function getWeekDays() {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(selectedWeekStart);
      date.setDate(selectedWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }

  function getPlanForDate(date) {
    const dateStr = date.toISOString().split("T")[0];
    return plan.find((entry) => entry.datum === dateStr);
  }

  function getSlotForDay(dayIndex) {
    return slots.find((slot) => slot.wochentag === dayIndex);
  }

  function openSpontaneousModal(date, planEntry) {
    const datum = date.toISOString().split("T")[0];
    setSpontaneousDraft({
      id: planEntry?.id || null,
      datum,
      trainingstyp: planEntry?.trainingstyp || "locker",
      uhrzeit_start: planEntry?.uhrzeit_start || "",
      uhrzeit_ende: planEntry?.uhrzeit_ende || "",
      dauer_minuten: planEntry?.dauer_minuten
        ? String(planEntry.dauer_minuten)
        : "",
    });
    setSpontaneousOpen(true);
  }

  async function saveSpontaneousTraining() {
    const duration = Number(spontaneousDraft.dauer_minuten);
    if (!spontaneousDraft.datum) {
      alert("Datum fehlt.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      alert("Bitte eine gültige Dauer in Minuten angeben.");
      return;
    }
    if (!spontaneousDraft.uhrzeit_start) {
      alert("Bitte eine Start-Uhrzeit angeben.");
      return;
    }

    setSpontaneousSaving(true);
    try {
      const payload = {
        datum: spontaneousDraft.datum,
        trainingstyp: spontaneousDraft.trainingstyp,
        dauer_minuten: duration,
        uhrzeit_start: spontaneousDraft.uhrzeit_start,
        uhrzeit_ende: spontaneousDraft.uhrzeit_ende || null,
        status: "geplant",
        ist_spontan: true,
        erstellt_von_ai: false,
      };

      if (spontaneousDraft.id) {
        const res = await fetch("/api/training-plan", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: spontaneousDraft.id, ...payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      } else {
        const res = await fetch("/api/training-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: [payload] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      }

      setSpontaneousOpen(false);
      await loadData();
      window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
    } catch (error) {
      console.error("Error saving spontaneous training:", error);
      alert(error.message);
    } finally {
      setSpontaneousSaving(false);
    }
  }

  function toggleSlotAvailability(dayIndex) {
    const existingSlot = getSlotForDay(dayIndex);
    if (existingSlot) {
      setSlots(
        slots.map((slot) =>
          slot.wochentag === dayIndex
            ? { ...slot, verfuegbar: !slot.verfuegbar }
            : slot
        )
      );
    } else {
      setSlots([
        ...slots,
        {
          wochentag: dayIndex,
          verfuegbar: true,
          uhrzeit_start: "07:00",
          uhrzeit_ende: "08:00",
        },
      ]);
    }
  }

  function updateSlotTime(dayIndex, field, value) {
    const existingSlot = getSlotForDay(dayIndex);
    if (existingSlot) {
      setSlots(
        slots.map((slot) =>
          slot.wochentag === dayIndex ? { ...slot, [field]: value } : slot
        )
      );
    } else {
      setSlots([
        ...slots,
        { wochentag: dayIndex, verfuegbar: true, [field]: value },
      ]);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-text-muted">Laden...</div>
      </div>
    );
  }

  const weekDays = getWeekDays();
  const coachContext = encodeURIComponent(
    "Lass uns meinen Trainingsplan besprechen"
  );
  const isoWeek = getISOWeekNumber(selectedWeekStart);
  const hasAnyPlanInWeek = weekDays.some((d) => Boolean(getPlanForDate(d)));
  const showNextWeekEmptyState = activeTab === "next" && !hasAnyPlanInWeek;

  const weekLabel = (() => {
    if (weekOffset === 0) return `KW ${isoWeek} – Diese Woche`;
    if (weekOffset === 1) return `KW ${isoWeek} – Nächste Woche`;
    if (weekOffset < 0) return `KW ${isoWeek} – ${Math.abs(weekOffset)} Woche(n) zurück`;
    return `KW ${isoWeek} – ${weekOffset} Wochen voraus`;
  })();

  return (
    <div className="space-y-8">
      {spontaneousOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-md border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-tight text-text">
              Spontanes Training hinzufügen
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-text-muted">
                  Trainingstyp
                </label>
                <select
                  value={spontaneousDraft.trainingstyp}
                  onChange={(e) =>
                    setSpontaneousDraft((d) => ({
                      ...d,
                      trainingstyp: e.target.value,
                    }))
                  }
                  className="input-field text-sm"
                >
                  <option value="locker">Locker</option>
                  <option value="tempo">Tempo</option>
                  <option value="intervall">Intervall</option>
                  <option value="langlauf">Langer Lauf</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-text-muted">
                    Von
                  </label>
                  <input
                    type="time"
                    value={spontaneousDraft.uhrzeit_start}
                    onChange={(e) =>
                      setSpontaneousDraft((d) => ({
                        ...d,
                        uhrzeit_start: e.target.value,
                      }))
                    }
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-text-muted">
                    Bis
                  </label>
                  <input
                    type="time"
                    value={spontaneousDraft.uhrzeit_ende}
                    onChange={(e) =>
                      setSpontaneousDraft((d) => ({
                        ...d,
                        uhrzeit_ende: e.target.value,
                      }))
                    }
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-text-muted">
                  Dauer (Minuten)
                </label>
                <input
                  type="number"
                  min="1"
                  value={spontaneousDraft.dauer_minuten}
                  onChange={(e) =>
                    setSpontaneousDraft((d) => ({
                      ...d,
                      dauer_minuten: e.target.value,
                    }))
                  }
                  className="input-field text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSpontaneousOpen(false)}
                  disabled={spontaneousSaving}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={saveSpontaneousTraining}
                  disabled={spontaneousSaving}
                  className="btn-primary"
                >
                  {spontaneousSaving ? "Speichern …" : "Bestätigen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + Wochennavigation */}
      <div className="rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("this");
                setWeekOffset(0);
              }}
              className={`py-3 text-xs font-extrabold uppercase tracking-widest transition ${
                activeTab === "this"
                  ? "text-text border-b-2 border-accent"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Diese Woche
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("next");
                setWeekOffset(1);
              }}
              className={`py-3 text-xs font-extrabold uppercase tracking-widest transition ${
                activeTab === "next"
                  ? "text-text border-b-2 border-accent"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Nächste Woche
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="rounded-md border border-border bg-bg p-2 text-text-muted hover:text-text"
              title="Vorherige Woche"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[200px] text-center text-xs font-bold uppercase tracking-wider text-text-muted">
              {weekLabel}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="rounded-md border border-border bg-bg p-2 text-text-muted hover:text-text"
              title="Nächste Woche"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Mobile label */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:hidden">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-md border border-border bg-bg p-2 text-text-muted hover:text-text"
            title="Vorherige Woche"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
            {weekLabel}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-md border border-border bg-bg p-2 text-text-muted hover:text-text"
            title="Nächste Woche"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/chat?context=${coachContext}`}
          className="btn-secondary flex items-center gap-2"
        >
          <MessageSquare size={16} />
          Mit Coach besprechen
        </Link>
        <button
          onClick={generateNewPlan}
          disabled={generatingPlan}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw
            size={16}
            className={generatingPlan ? "animate-spin" : ""}
          />
          Plan aktualisieren
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="text-accent" size={22} />
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
            Wochenplan
          </h2>
        </div>

        {showNextWeekEmptyState ? (
          <div className="rounded-md border border-border bg-surface-elevated p-4">
            <p className="text-sm font-semibold text-text">
              Für nächste Woche sind noch keine Einheiten geplant.
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Erstelle jetzt automatisch deinen Plan für die kommende Woche.
            </p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={generatePlanForSelectedWeek}
                disabled={generatingPlan}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw
                  size={16}
                  className={generatingPlan ? "animate-spin" : ""}
                />
                Nächste Woche planen
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((date, index) => {
            const planEntry = getPlanForDate(date);
            const dateStr = date.toISOString().split("T")[0];
            const weather = weatherByDate[dateStr];
            const colorClass = planEntry
              ? TRAINING_COLORS[planEntry.trainingstyp] ||
                TRAINING_COLORS.pause
              : "border-border bg-surface";
            const statusClass = planEntry
              ? STATUS_COLORS[planEntry.status]
              : "text-text-muted";

            return (
              <div
                key={index}
                className={`run-card cursor-pointer border-2 p-4 transition-all hover:scale-[1.02] ${colorClass}`}
                onClick={() => {
                  if (planEntry) {
                    const nextStatus =
                      planEntry.status === "geplant"
                        ? "abgeschlossen"
                        : planEntry.status === "abgeschlossen"
                          ? "uebersprungen"
                          : "geplant";
                    updatePlanEntry(planEntry.id, { status: nextStatus });
                  }
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-text-muted">
                    {WOCHENTAGE[index]}
                  </span>
                  <div className="flex items-center gap-2">
                    {weather && (
                      <span
                        className="text-xs text-text-muted"
                        title={`${weather.temp}°C`}
                      >
                        {weatherEmoji(weather.weathercode)} {weather.temp}°
                      </span>
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-border bg-bg p-1 text-text-muted transition-all hover:text-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSpontaneousModal(date, planEntry);
                      }}
                      title="Spontanes Training hinzufügen"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <p className="mb-1 text-[10px] text-text-muted">
                  {date.toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </p>
                <span
                  className={`mb-2 block text-xs font-bold uppercase ${statusClass}`}
                >
                  {planEntry ? planEntry.status : "-"}
                </span>
                {planEntry ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold uppercase text-text">
                      {planEntry.ist_spontan ? "⚡ " : ""}
                      {planEntry.trainingstyp}
                    </p>
                    {planEntry.distanz_km && planEntry.dauer_minuten ? (
                      <p className="text-xs text-text-muted">
                        📏 {planEntry.distanz_km} km · ⏱ {planEntry.dauer_minuten} Min
                      </p>
                    ) : null}
                    {planEntry.beschreibung ? (
                      (() => {
                        const lines = planEntry.beschreibung.split('\n');
                        const hfLine = lines.find(l => l.includes('HF') || l.includes('bpm'));
                        const hauptteilLine = lines.find(l => l.toLowerCase().includes('hauptteil'));
                        
                        // Extrahiere Hauptteil für eine Zeile
                        let hauptteil = "";
                        if (hauptteilLine) {
                          hauptteil = hauptteilLine.replace('Hauptteil:', '').trim();
                          // Entferne HF-Zone aus Hauptteil für Kürze
                          hauptteil = hauptteil.split('|')[0].trim();
                        }
                        
                        return (
                          <div className="space-y-0.5">
                            {hfLine && (
                              <p className="text-xs text-text-muted">
                                💓 {hfLine.replace('HF-Zone:', '').replace('HF:', '').trim()}
                              </p>
                            )}
                            {hauptteil && (
                              <p className="text-xs text-text-muted truncate">
                                {hauptteil}
                              </p>
                            )}
                          </div>
                        );
                      })()
                    ) : null}
                    {planEntry.uhrzeit_start ? (
                      <p className="text-xs text-text-muted">
                        ⏰ {String(planEntry.uhrzeit_start).slice(0, 5)}
                        {planEntry.uhrzeit_ende
                          ? `–${String(planEntry.uhrzeit_ende).slice(0, 5)}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Kein Training</p>
                )}
              </div>
            );
          })}
        </div>

        {activeTab === "next" ? (
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-widest text-text-muted">
                Wetter-Vorschau (7 Tage)
              </p>
              <p className="text-xs text-text-muted">Open-Meteo</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {weekDays.map((date, idx) => {
                const dateStr = formatISO(date);
                const w = weatherByDate[dateStr];
                return (
                  <div
                    key={idx}
                    className="rounded-md border border-border bg-bg px-3 py-2"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {WOCHENTAGE[idx]}
                    </p>
                    {w ? (
                      <p className="mt-1 text-sm font-semibold text-text">
                        {weatherEmoji(w.weathercode)} {Math.round(w.tempMin)}–{Math.round(w.tempMax)}°
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-text-muted">—</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="text-accent" size={22} />
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
            Trainingszeiten
          </h2>
        </div>

        <div className="divide-y divide-border rounded-md border border-border bg-surface">
          {WOCHENTAGE.map((tag, index) => {
            const slot = getSlotForDay(index);
            return (
              <div key={tag} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="w-8 text-sm font-extrabold uppercase text-text">
                    {tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSlotAvailability(index)}
                    className={`rounded-md px-3 py-1 text-xs font-bold uppercase transition-all ${
                      slot?.verfuegbar
                        ? "bg-accent text-white"
                        : "border border-border bg-bg text-text-muted"
                    }`}
                  >
                    {slot?.verfuegbar ? "Aktiv" : "Aus"}
                  </button>
                  {slot?.verfuegbar && (
                    <div className="flex flex-1 flex-wrap gap-2">
                      <input
                        type="time"
                        value={slot.uhrzeit_start || ""}
                        onChange={(e) =>
                          updateSlotTime(
                            index,
                            "uhrzeit_start",
                            e.target.value
                          )
                        }
                        className="input-field text-sm"
                      />
                      <span className="self-center text-text-muted">–</span>
                      <input
                        type="time"
                        value={slot.uhrzeit_ende || ""}
                        onChange={(e) =>
                          updateSlotTime(index, "uhrzeit_ende", e.target.value)
                        }
                        className="input-field text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveSlots}
            disabled={savingSlots}
            className="btn-primary"
          >
            {savingSlots ? "Speichern …" : "Zeiten speichern"}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Zeitslots werden auch vom Coach für Planvorschläge genutzt (
          {slots.filter((s) => s.verfuegbar).length} Trainingstage).
        </p>
      </div>
    </div>
  );
}
