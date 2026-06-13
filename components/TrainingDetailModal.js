"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, Edit3, MapPin, Clock, Target } from "lucide-react";
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
  Bar,
  Legend,
} from "recharts";

/**
 * TrainingDetailModal – Zeigt Details einer Trainingseinheit mit Grafiken.
 * 
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - trainingEntry: { datum, trainingstyp, distanz_km, dauer_minuten, beschreibung, status, ... }
 * - completedRun: { distanz_km, dauer_minuten, pace_data: [{km, pace}], hf_data: [{minute, bpm}], ... } | null
 * - onComplete: () => void
 * - onSkip: () => void
 * - onLogRun: () => void
 */
export default function TrainingDetailModal({
  open,
  onClose,
  trainingEntry,
  completedRun = null,
  onComplete,
  onSkip,
  onLogRun,
}) {
  if (!open || !trainingEntry) return null;

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
    const dauer = trainingEntry.dauer_minuten || 30;
    const data = [];
    
    // Calculate phases
    const warmupDist = Math.min(2, distanz * 0.2);
    const cooldownDist = Math.min(2, distanz * 0.2);
    const mainDist = distanz - warmupDist - cooldownDist;

    for (let km = 0; km <= distanz; km += 0.5) {
      let phasePace;
      let phase;
      
      if (km < warmupDist) {
        // Warm-up: slower pace
        phasePace = targetPace + 0.5;
        phase = "warmup";
      } else if (km > distanz - cooldownDist) {
        // Cool-down: slower pace
        phasePace = targetPace + 0.5;
        phase = "cooldown";
      } else {
        // Main part: target pace with slight variation
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
    
    // Base HF based on zone
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
        // Warm-up phase: gradual increase from base
        hf = baseHF - 10 + progress * 40;
        phase = "warmup";
      } else if (min > dauer * 0.85) {
        // Cool-down phase: gradual decrease
        hf = targetHF - (min - dauer * 0.85) / (dauer * 0.15) * 30;
        phase = "cooldown";
      } else {
        // Main phase: around target with variation
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
    const distanz = trainingEntry.distanz_km || 5;

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

  // Custom tooltip for pace chart
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

  // Custom tooltip for HF chart
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

  // Get phase color for chart backgrounds
  const getPhaseColor = (phase) => {
    switch (phase) {
      case "warmup": return "rgba(34, 197, 94, 0.1)";
      case "main": return "rgba(59, 130, 246, 0.1)";
      case "cooldown": return "rgba(34, 197, 94, 0.1)";
      default: return "transparent";
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface border border-border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between bg-surface pb-4 border-b border-border">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
              {formatDate(trainingEntry.datum)}
            </p>
            <h2 className={`mt-1 text-2xl font-black uppercase tracking-tight ${typeInfo.color}`}>
              {typeInfo.label}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-sm ${
                isCompleted ? "text-green-500" : 
                isSkipped ? "text-red-500" : "text-text-muted"
              }`}>
                {isCompleted ? "✅ Abgeschlossen" : 
                 isSkipped ? "❌ Übersprungen" : "⏳ Geplant"}
              </span>
              {trainingEntry.erstellt_von_ai && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  AI
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-bg p-2 text-text-muted hover:text-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* SECTION 1: OVERVIEW (3 Stat Cards) */}
          <section>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Target size={16} />
              Übersicht
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {/* Distance */}
              <div className="rounded-xl border border-border bg-bg p-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/30"></div>
                <MapPin size={18} className="mx-auto mb-2 text-blue-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Distanz
                </p>
                <p className="mt-1 text-2xl font-black text-text">
                  {trainingEntry.distanz_km || "-"}
                </p>
                <p className="text-[10px] text-text-muted">km</p>
              </div>

              {/* Duration */}
              <div className="rounded-xl border border-border bg-bg p-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-green-500/30"></div>
                <Clock size={18} className="mx-auto mb-2 text-green-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Dauer
                </p>
                <p className="mt-1 text-2xl font-black text-text">
                  {trainingEntry.dauer_minuten || "-"}
                </p>
                <p className="text-[10px] text-text-muted">Min</p>
              </div>

              {/* Target Pace */}
              <div className="rounded-xl border border-border bg-bg p-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/30"></div>
                <Target size={18} className="mx-auto mb-2 text-orange-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Ziel-Pace
                </p>
                <p className="mt-1 text-2xl font-black text-text">
                  {formatPace(targetPace)}
                </p>
                <p className="text-[10px] text-text-muted">min/km</p>
              </div>
            </div>
          </section>

          {/* SECTION 2: TRAINING STRUCTURE (Timeline) */}
          <section>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-muted">
              Trainingsstruktur
            </h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-border"></div>
              
              <div className="space-y-4">
                {trainingPhases.map((phase, idx) => (
                  <div key={idx} className="relative flex items-start gap-4 pl-12">
                    {/* Timeline dot */}
                    <div className={`absolute left-4 top-1 w-4 h-4 rounded-full border-2 ${phase.borderColor} ${phase.bgColor} flex items-center justify-center z-10`}>
                      <div className={`w-2 h-2 rounded-full ${phase.color.replace("text-", "bg-")}`}></div>
                    </div>
                    
                    {/* Content card */}
                    <div className={`flex-1 rounded-lg border ${phase.borderColor} ${phase.bgColor} p-3`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">{phase.icon}</span>
                        <span className="text-xs font-bold text-text-muted">{phase.duration} Min</span>
                      </div>
                      <h4 className={`text-sm font-bold ${phase.color}`}>{phase.name}</h4>
                      <p className="text-xs text-text-muted mt-1">{phase.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 3: HEART RATE ZONES (Visual Bars) */}
          <section>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-muted">
              Herzfrequenz Zonen
            </h3>
            <div className="space-y-2">
              {hfZones.map((zone) => {
                const isActive = activeHFZones.includes(zone.zone);
                const percentage = ((zone.max - zone.min) / 30) * 100;
                
                return (
                  <div key={zone.zone} className="flex items-center gap-3">
                    <span className={`w-16 text-xs font-bold ${isActive ? "text-text" : "text-text-muted"}`}>
                      {zone.label}
                    </span>
                    <div className="flex-1 h-6 rounded-full bg-bg border border-border relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isActive ? "opacity-100" : "opacity-30"}`}
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: zone.color,
                          boxShadow: isActive ? `0 0 10px ${zone.color}40` : "none",
                        }}
                      />
                    </div>
                    <span className="w-20 text-xs text-text-muted text-right">
                      {zone.min}-{zone.max} bpm
                    </span>
                    {isActive && (
                      <span className="w-6 text-green-500">
                        <CheckCircle size={14} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Active zones summary */}
            <div className="mt-4 p-3 rounded-lg bg-bg border border-border">
              <p className="text-xs text-text-muted">
                <span className="font-bold text-text">Aktive Zonen:</span>{" "}
                {activeHFZones.map(z => `Zone ${z}`).join(", ")} – {hfZones.filter(z => activeHFZones.includes(z.zone)).map(z => z.description).join(", ")}
              </p>
            </div>
          </section>

          {/* SECTION 4: GRAPHS */}
          <section className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">
              Grafiken
            </h3>

              {/* Graphic 1: Pace Distribution */}
              <div className="rounded-xl border border-border bg-bg p-4">
                <h4 className="mb-4 text-sm font-bold text-text">
                  Optimale Pace-Verteilung
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="km"
                        label={{ value: "Kilometer", position: "insideBottom", offset: -5, fill: "#666", fontSize: 12 }}
                        stroke="#666"
                        tick={{ fill: "#666", fontSize: 10 }}
                      />
                      <YAxis
                        domain={["dataMin - 0.5", "dataMax + 0.5"]}
                        label={{ value: "min/km", angle: -90, position: "insideLeft", fill: "#666", fontSize: 12 }}
                        stroke="#666"
                        reversed
                        tick={{ fill: "#666", fontSize: 10 }}
                      />
                      <Tooltip content={<PaceTooltip />} />
                      <Legend />
                      {/* Target pace reference line */}
                      <ReferenceLine
                        y={targetPace}
                        stroke="#EF4444"
                        strokeDasharray="5 5"
                        label={{ value: "Ziel-Pace", position: "right", fill: "#EF4444", fontSize: 10 }}
                      />
                      {/* Optimal pace area */}
                      <Area
                        type="monotone"
                        dataKey="optimalPace"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fill="url(#paceGradient)"
                        name="Optimale Pace"
                      />
                      {/* Actual pace line (wenn Lauf-Daten vorhanden) */}
                      {completedRun?.pace_data && (
                        <Line
                          type="monotone"
                          dataKey="pace"
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={false}
                          name="Tatsächliche Pace"
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Graphic 2: Heart Rate Progression */}
              <div className="rounded-xl border border-border bg-bg p-4">
                <h4 className="mb-4 text-sm font-bold text-text">
                  Optimaler HF-Verlauf
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={hfData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hfGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F8FAFC" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#F8FAFC" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="minute"
                        label={{ value: "Minuten", position: "insideBottom", offset: -5, fill: "#666", fontSize: 12 }}
                        stroke="#666"
                        tick={{ fill: "#666", fontSize: 10 }}
                      />
                      <YAxis
                        domain={[Math.min(...hfZones.map(z => z.min)) - 10, Math.max(...hfZones.map(z => z.max)) + 10]}
                        label={{ value: "bpm", angle: -90, position: "insideLeft", fill: "#666", fontSize: 12 }}
                        stroke="#666"
                        tick={{ fill: "#666", fontSize: 10 }}
                      />
                      <Tooltip content={<HFTooltip />} />
                      <Legend />
                      {/* HF Zone background areas */}
                      {hfZones.map((zone) => (
                        <ReferenceArea
                          key={zone.zone}
                          y1={zone.min}
                          y2={zone.max}
                          fill={zone.colorLight}
                          label={{
                            value: zone.label,
                            position: "right",
                            fill: zone.color,
                            fontSize: 9,
                            angle: 90,
                          }}
                        />
                      ))}
                      {/* Optimal HF line */}
                      <Area
                        type="monotone"
                        dataKey="optimalHF"
                        stroke="#F8FAFC"
                        strokeWidth={2}
                        fill="url(#hfGradient)"
                        name="Optimale HF"
                      />
                      {/* Actual HF line (wenn Lauf-Daten vorhanden) */}
                      {completedRun?.hf_data && (
                        <Line
                          type="monotone"
                          dataKey="bpm"
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={false}
                          name="Tatsächliche HF"
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
          </section>

          {/* SECTION 5: ACTIONS */}
          <section className="sticky bottom-0 bg-surface pt-4 border-t border-border">
            <div className="grid grid-cols-3 gap-3">
              {/* Complete button */}
              <button
                type="button"
                onClick={() => onComplete?.()}
                disabled={isCompleted || isSkipped}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                  isCompleted
                    ? "bg-green-500/20 text-green-500 border border-green-500/30 cursor-default"
                    : isSkipped
                    ? "bg-bg text-text-muted border border-border cursor-not-allowed"
                    : "bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20"
                }`}
              >
                <CheckCircle size={16} />
                Abgeschlossen
              </button>

              {/* Skip button */}
              <button
                type="button"
                onClick={() => onSkip?.()}
                disabled={isCompleted || isSkipped}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                  isSkipped
                    ? "bg-red-500/20 text-red-500 border border-red-500/30 cursor-default"
                    : isCompleted
                    ? "bg-bg text-text-muted border border-border cursor-not-allowed"
                    : "bg-bg text-text hover:bg-bg/80 border border-border"
                }`}
              >
                <XCircle size={16} />
                Überspringen
              </button>

              {/* Log run button */}
              <button
                type="button"
                onClick={() => onLogRun?.()}
                disabled={Boolean(completedRun) || isSkipped}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                  Boolean(completedRun) || isSkipped
                    ? "bg-bg text-text-muted border border-border cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                }`}
              >
                <Edit3 size={16} />
                Lauf eintragen
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
