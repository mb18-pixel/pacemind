"use client";

import { XCircle, CheckCircle, MapPin, Clock, Target } from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
  Legend,
} from "recharts";

export default function TrainingCard({ trainingEntry, completedRun = null }) {
  if (!trainingEntry) return null;

  const isCompleted = trainingEntry.status === "abgeschlossen" || completedRun !== null;
  const isSkipped = trainingEntry.status === "uebersprungen";

  // Parse description for structured data
  const parseBeschreibung = (beschreibung) => {
    if (!beschreibung) return null;
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
    return out;
  };

  const structured = parseBeschreibung(trainingEntry.beschreibung);

  // Extract HF zones from training entry or use defaults
  const getHFZones = () => {
    const maxHF = trainingEntry.max_hf || 193; // Default based on age
    return [
      { zone: 1, min: Math.round(maxHF * 0.6), max: Math.round(maxHF * 0.66), label: "Zone 1", color: "#9CA3AF", colorLight: "rgba(156, 163, 175, 0.2)", description: "Regeneration" },
      { zone: 2, min: Math.round(maxHF * 0.66), max: Math.round(maxHF * 0.76), label: "Zone 2", color: "#3B82F6", colorLight: "rgba(59, 130, 246, 0.2)", description: "Grundlage" },
      { zone: 3, min: Math.round(maxHF * 0.76), max: Math.round(maxHF * 0.8), label: "Zone 3", color: "#EAB308", colorLight: "rgba(234, 179, 8, 0.2)", description: "Aerobe Schwelle" },
      { zone: 4, min: Math.round(maxHF * 0.8), max: Math.round(maxHF * 0.85), label: "Zone 4", color: "#F97316", colorLight: "rgba(249, 115, 22, 0.2)", description: "Schwelle" },
      { zone: 5, min: Math.round(maxHF * 0.85), max: Math.round(maxHF * 0.9), label: "Zone 5", color: "#EF4444", colorLight: "rgba(239, 68, 68, 0.2)", description: "VO2max" },
    ];
  };

  const hfZones = getHFZones();

  // Determine active HF zones based on training type
  const getActiveHFZones = () => {
    const type = trainingEntry.trainingstyp;
    switch (type) {
      case "locker":
      case "langlauf":
        return [1, 2];
      case "tempo":
        return [3, 4];
      case "intervall":
        return [4, 5];
      case "regeneration":
        return [1];
      default:
        return [2, 3];
    }
  };

  const activeHFZones = getActiveHFZones();

  // Calculate target pace from description or training data
  const getTargetPace = () => {
    if (structured?.pace_ziel) {
      // Parse "5:30 min/km" format
      const match = structured.pace_ziel.match(/(\d+):(\d+)/);
      if (match) {
        return parseInt(match[1]) + parseInt(match[2]) / 60;
      }
    }
    // Calculate from distance and duration
    if (trainingEntry.distanz_km && trainingEntry.dauer_minuten) {
      return trainingEntry.dauer_minuten / trainingEntry.distanz_km;
    }
    return 6.0; // Default 6:00 min/km
  };

  const targetPace = getTargetPace();

  // Format pace as MM:SS
  const formatPace = (paceMinPerKm) => {
    const min = Math.floor(paceMinPerKm);
    const sec = Math.round((paceMinPerKm - min) * 60);
    return `${min}:${String(sec).padStart(2, "0")}`;
  };

  // Generate simulated pace data for planned training
  const generateSimulatedPaceData = () => {
    const distanz = trainingEntry.distanz_km || 5;
    const data = [];
    
    // Calculate phases
    const warmupDist = Math.min(2, distanz * 0.2);
    const cooldownDist = Math.min(2, distanz * 0.2);

    for (let km = 0; km <= distanz; km += 0.5) {
      let phasePace;
      let phase;
      
      if (km < warmupDist) {
        phasePace = targetPace + 0.5;
        phase = "warmup";
      } else if (km > distanz - cooldownDist) {
        phasePace = targetPace + 0.5;
        phase = "cooldown";
      } else {
        phasePace = targetPace + (Math.random() - 0.5) * 0.3;
        phase = "main";
      }

      data.push({
        km: Math.round(km * 10) / 10,
        zielPace: targetPace,
        optimalPace: Math.round(phasePace * 100) / 100,
        phase: phase,
      });
    }
    return data;
  };

  // Generate simulated heart rate data for planned training
  const generateSimulatedHFData = () => {
    const dauer = trainingEntry.dauer_minuten || 30;
    const data = [];
    const type = trainingEntry.trainingstyp;
    
    let baseHF, targetHF;
    switch (type) {
      case "locker":
      case "langlauf":
        baseHF = hfZones[1].min + 5;
        targetHF = hfZones[1].max - 5;
        break;
      case "tempo":
        baseHF = hfZones[2].min + 5;
        targetHF = hfZones[3].max - 5;
        break;
      case "intervall":
        baseHF = hfZones[3].min;
        targetHF = hfZones[4].max - 5;
        break;
      default:
        baseHF = hfZones[1].min + 5;
        targetHF = hfZones[2].max - 5;
    }

    for (let min = 0; min <= dauer; min += 2) {
      const progress = min / dauer;
      let hf;
      let phase;

      if (min < dauer * 0.15) {
        hf = baseHF - 10 + progress * 40;
        phase = "warmup";
      } else if (min > dauer * 0.85) {
        hf = targetHF - (min - dauer * 0.85) / (dauer * 0.15) * 30;
        phase = "cooldown";
      } else {
        const mainProgress = (min - dauer * 0.15) / (dauer * 0.7);
        hf = baseHF + mainProgress * (targetHF - baseHF) + (Math.random() - 0.5) * 5;
        phase = "main";
      }

      data.push({
        minute: Math.round(min),
        optimalHF: Math.round(hf),
        phase: phase,
      });
    }
    return data;
  };

  // Get or generate data
  const paceData = completedRun?.pace_data || generateSimulatedPaceData();
  const hfData = completedRun?.hf_data || generateSimulatedHFData();

  // Training phases info
  const getTrainingPhases = () => {
    const phases = [];
    const dauer = trainingEntry.dauer_minuten || 30;

    // Warm-up
    const warmupMin = Math.round(dauer * 0.15);
    phases.push({
      name: "Warm-up",
      duration: warmupMin,
      icon: "🟢",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      description: structured?.warmup || `${warmupMin} Min einlaufen`,
    });

    // Main part
    const mainMin = Math.round(dauer * 0.7);
    let mainDescription = structured?.hauptteil || `${mainMin} Min Hauptteil`;
    phases.push({
      name: "Hauptteil",
      duration: mainMin,
      icon: trainingEntry.trainingstyp === "intervall" ? "🔴" : trainingEntry.trainingstyp === "tempo" ? "🟠" : "🔵",
      color: trainingEntry.trainingstyp === "intervall" ? "text-red-500" : trainingEntry.trainingstyp === "tempo" ? "text-orange-500" : "text-blue-500",
      bgColor: trainingEntry.trainingstyp === "intervall" ? "bg-red-500/10" : trainingEntry.trainingstyp === "tempo" ? "bg-orange-500/10" : "bg-blue-500/10",
      borderColor: trainingEntry.trainingstyp === "intervall" ? "border-red-500/30" : trainingEntry.trainingstyp === "tempo" ? "border-orange-500/30" : "border-blue-500/30",
      description: mainDescription,
    });

    // Cool-down
    const cooldownMin = Math.round(dauer * 0.15);
    phases.push({
      name: "Cool-down",
      duration: cooldownMin,
      icon: "🟢",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      description: structured?.cooldown || `${cooldownMin} Min auslaufen`,
    });

    return phases;
  };

  const trainingPhases = getTrainingPhases();

  const TRAINING_TYPE_LABELS = {
    intervall: { label: "Intervall", color: "text-red-500" },
    tempo: { label: "Tempolauf", color: "text-orange-500" },
    locker: { label: "Lockerer Lauf", color: "text-green-500" },
    pause: { label: "Pause", color: "text-gray-500" },
    langlauf: { label: "Langer Lauf", color: "text-blue-500" },
    regeneration: { label: "Regeneration", color: "text-emerald-500" },
  };

  const typeInfo = TRAINING_TYPE_LABELS[trainingEntry.trainingstyp] || {
    label: trainingEntry.trainingstyp,
    color: "text-gray-500",
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });
  };

  const PaceTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg">
          <p className="font-bold mb-1">{label} km</p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)} min/km
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const HFTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg">
          <p className="font-bold mb-1">{label} Min</p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ color: entry.color }}>
              {entry.name}: {entry.value} bpm
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full max-w-2xl mt-4 rounded-xl bg-surface border border-border shadow-xl overflow-hidden shrink-0 snap-center">
      {/* Header */}
      <div className="flex items-start justify-between bg-surface p-4 border-b border-border">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
            {formatDate(trainingEntry.datum)}
          </p>
          <h2 className={`mt-1 text-xl font-black uppercase tracking-tight ${typeInfo.color}`}>
            {typeInfo.label}
          </h2>
        </div>
        <div className="flex items-center">
          {trainingEntry.erstellt_von_ai && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold tracking-widest border border-accent/20">
              AI GEPLANT
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* SECTION 1: OVERVIEW */}
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Target size={14} />
            Übersicht
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-bg p-3 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/30"></div>
              <MapPin size={16} className="mx-auto mb-1.5 text-blue-500" />
              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Distanz</p>
              <p className="mt-0.5 text-xl font-black text-text">{trainingEntry.distanz_km || "-"}</p>
            </div>
            <div className="rounded-xl border border-border bg-bg p-3 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-green-500/30"></div>
              <Clock size={16} className="mx-auto mb-1.5 text-green-500" />
              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Dauer</p>
              <p className="mt-0.5 text-xl font-black text-text">{trainingEntry.dauer_minuten || "-"}</p>
            </div>
            <div className="rounded-xl border border-border bg-bg p-3 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/30"></div>
              <Target size={16} className="mx-auto mb-1.5 text-orange-500" />
              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Ziel-Pace</p>
              <p className="mt-0.5 text-xl font-black text-text">{formatPace(targetPace)}</p>
            </div>
          </div>
        </section>

        {/* SECTION 2: TIMELINE */}
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Trainingsstruktur</h3>
          <div className="relative">
            <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-border"></div>
            <div className="space-y-3">
              {trainingPhases.map((phase, idx) => (
                <div key={idx} className="relative flex items-start gap-3 pl-12">
                  <div className={`absolute left-4 top-0.5 w-4 h-4 rounded-full border-2 ${phase.borderColor} ${phase.bgColor} flex items-center justify-center`} style={{ zIndex: 10 }}>
                    <div className={`w-2 h-2 rounded-full ${phase.color.replace("text-", "bg-")}`}></div>
                  </div>
                  <div className={`flex-1 rounded-lg border ${phase.borderColor} ${phase.bgColor} p-2.5`}>
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-bold ${phase.color}`}>{phase.name}</h4>
                      <span className="text-[10px] font-bold text-text-muted">{phase.duration} Min</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 leading-relaxed">{phase.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: HF ZONES */}
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Herzfrequenz Zonen</h3>
          <div className="space-y-1.5">
            {hfZones.map((zone) => {
              const isActive = activeHFZones.includes(zone.zone);
              const percentage = ((zone.max - zone.min) / 30) * 100;
              return (
                <div key={zone.zone} className="flex items-center gap-2">
                  <span className={`w-12 text-[10px] font-bold ${isActive ? "text-text" : "text-text-muted"}`}>
                    {zone.label}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-bg border border-border relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isActive ? "opacity-100" : "opacity-30"}`}
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: zone.color,
                        boxShadow: isActive ? `0 0 10px ${zone.color}40` : "none",
                      }}
                    />
                  </div>
                  <span className="w-16 text-[10px] text-text-muted text-right">
                    {zone.min}-{zone.max}
                  </span>
                  {isActive && <CheckCircle size={10} className="text-green-500 ml-1 shrink-0" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: GRAPHS */}
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-bg p-3">
            <h4 className="mb-3 text-xs font-bold text-text">Optimale Pace-Verteilung</h4>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`paceGradient-${trainingEntry.datum}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="km" stroke="#666" tick={{ fill: "#666", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} stroke="#666" reversed tick={{ fill: "#666", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<PaceTooltip />} />
                  <ReferenceLine y={targetPace} stroke="#EF4444" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="optimalPace" stroke="#3B82F6" strokeWidth={2} fill={`url(#paceGradient-${trainingEntry.datum})`} name="Optimale Pace" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-3">
            <h4 className="mb-3 text-xs font-bold text-text">Optimaler HF-Verlauf</h4>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hfData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`hfGradient-${trainingEntry.datum}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F8FAFC" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#F8FAFC" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="minute" stroke="#666" tick={{ fill: "#666", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[Math.min(...hfZones.map(z => z.min)) - 10, Math.max(...hfZones.map(z => z.max)) + 10]} stroke="#666" tick={{ fill: "#666", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<HFTooltip />} />
                  {hfZones.map((zone) => (
                    <ReferenceArea key={zone.zone} y1={zone.min} y2={zone.max} fill={zone.colorLight} />
                  ))}
                  <Area type="monotone" dataKey="optimalHF" stroke="#F8FAFC" strokeWidth={2} fill={`url(#hfGradient-${trainingEntry.datum})`} name="Optimale HF" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
