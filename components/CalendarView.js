"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, MessageSquare, Plus, RefreshCw } from "lucide-react";
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
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
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

  function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return start;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, slotsRes, weatherRes] = await Promise.all([
        fetch("/api/training-plan?days=14"),
        fetch("/api/training-slots"),
        fetch("/api/weather?days=14"),
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
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [selectedWeek, loadData]);

  useEffect(() => {
    function onPlanUpdated() {
      loadData();
    }
    window.addEventListener(PLAN_UPDATED_EVENT, onPlanUpdated);
    return () => window.removeEventListener(PLAN_UPDATED_EVENT, onPlanUpdated);
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

  function getWeekDays() {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(selectedWeek);
      date.setDate(selectedWeek.getDate() + i);
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
          Plan neu generieren
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="text-accent" size={22} />
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">
            Wochenplan
          </h2>
        </div>

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
                    {planEntry.uhrzeit_start ? (
                      <p className="text-xs text-text-muted">
                        {String(planEntry.uhrzeit_start).slice(0, 5)}
                        {planEntry.uhrzeit_ende
                          ? `–${String(planEntry.uhrzeit_ende).slice(0, 5)}`
                          : ""}
                      </p>
                    ) : null}
                    {planEntry.dauer_minuten ? (
                      <p className="text-xs text-text-muted">
                        {planEntry.dauer_minuten} min
                      </p>
                    ) : null}
                    {planEntry.distanz_km ? (
                      <p className="text-xs text-text-muted">
                        {planEntry.distanz_km} km
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
