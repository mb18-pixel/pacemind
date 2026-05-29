"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isoDate(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick80_20(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const cut = Math.max(0, Math.round(arr.length * 0.8));
  return { completed: arr.slice(0, cut), skipped: arr.slice(cut) };
}

function hasDistance(text) {
  return /\b\d+(?:[.,]\d+)?\s?km\b/i.test(text);
}

function hasZonesOrRpe(text) {
  return /RPE\s?\d/i.test(text) || /Zone\s?[1-5]/i.test(text) || /\bbpm\b/i.test(text);
}

function asPaceString(secPerKm) {
  const sec = Math.round(secPerKm);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return { paceMin: m, paceSec: Number(s), paceStr: `${m}:${s}` };
}

function computeMacroChecks(makro) {
  const checks = [];
  if (!Array.isArray(makro) || makro.length === 0) {
    return {
      totalWeeks: 0,
      week1: null,
      week8: null,
      week14: null,
      checks: [
        { name: "Makro-Skelett vorhanden", pass: false, details: "Kein makro_skelett im Response" },
      ],
    };
  }

  const totalWeeks = makro.length;
  const week1 = makro[0] || null;
  const week8 = makro[7] || null;
  const week14 = makro[13] || null;

  // 1) Volumensteigerung (nur wenn steigt: max 10%)
  let acwrOk = true;
  let acwrFail = null;
  for (let i = 1; i < makro.length; i++) {
    const prev = Number(makro[i - 1].wochenvolumen_km);
    const curr = Number(makro[i].wochenvolumen_km);
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
    if (curr > prev * 1.101) {
      acwrOk = false;
      acwrFail = `Woche ${i}→${i + 1}: ${prev} → ${curr} km`;
      break;
    }
  }
  checks.push({ name: "Volumen steigt max 10%/Woche", pass: acwrOk, details: acwrFail || "" });

  // 2) Deload alle 4 Wochen (mindestens Woche 4 + 8 vorhanden)
  const deloadWeeks = makro
    .filter((w) => w.deload)
    .map((w) => Number(w.woche))
    .filter((n) => Number.isFinite(n));
  const deloadOk = deloadWeeks.includes(4) && deloadWeeks.includes(8);
  checks.push({
    name: "Deload-Wochen alle 4 Wochen",
    pass: deloadOk,
    details: deloadWeeks.length ? `Gefunden: ${deloadWeeks.join(", ")}` : "Keine Deload-Wochen",
  });

  // 3) Tapering in letzten 2 Wochen (bei 16 Wochen HM: letzte 2 Wochen tapering)
  const taperTail = makro.slice(-2);
  const taperOk = taperTail.length === 2 && taperTail.every((w) => w.phase === "tapering");
  checks.push({
    name: "Tapering in letzten 2 Wochen",
    pass: taperOk,
    details: taperTail.map((w) => `W${w.woche}:${w.phase}`).join(" | "),
  });

  // 4) Long Run <= 33% des Wochenvolumens
  let longOk = true;
  let longFail = null;
  for (const w of makro) {
    const vol = Number(w.wochenvolumen_km);
    const lr = Number(w.max_long_run_km);
    if (!Number.isFinite(vol) || !Number.isFinite(lr)) continue;
    if (lr > vol * 0.33 + 0.11) {
      longOk = false;
      longFail = `W${w.woche}: long ${lr}km > 33% von ${vol}km`;
      break;
    }
  }
  checks.push({ name: "Long Run max 33% vom Wochenvolumen", pass: longOk, details: longFail || "" });

  return { totalWeeks, week1, week8, week14, checks };
}

export default function TestSimulationClient() {
  const supabase = useMemo(() => createClient(), []);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);

  const reportRef = useRef({
    meta: {},
    planChecks: [],
    coachChecks: [],
    actionChecks: [],
    chatTranscripts: [],
    weekLogs: [],
  });

  function log(line, data = null) {
    const entry = {
      ts: new Date().toISOString(),
      line,
      data,
    };
    setLogs((prev) => [...prev, entry]);
  }

  async function apiJson(path, { method = "GET", body, headers = {} } = {}, simulatedIso = null) {
    // 500ms Delay zwischen Calls (Groq Rate-Limit)
    await sleep(500);
    const res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(simulatedIso ? { "x-simulated-date": simulatedIso } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error || `HTTP ${res.status}`;
      throw new Error(`${path}: ${msg}`);
    }
    return json;
  }

  function updateProgress(current, total) {
    setProgress(Math.round((current / total) * 100));
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function ensureTestUser() {
    const email = "test.laeufer@pacemind.dev";
    const password = "TestRunner!12345";

    // Erst versuchen einzuloggen, sonst signup
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn?.error) {
      const signUp = await supabase.auth.signUp({ email, password });
      if (signUp?.error) {
        // wenn Signup nicht geht (z. B. Confirm required), trotzdem versuchen zu sign-in
        const signIn2 = await supabase.auth.signInWithPassword({ email, password });
        if (signIn2?.error) throw new Error(`Auth: ${signUp.error.message} / ${signIn2.error.message}`);
      } else {
        const signIn2 = await supabase.auth.signInWithPassword({ email, password });
        if (signIn2?.error) throw new Error(`Auth: ${signIn2.error.message}`);
      }
    }

    const { data } = await supabase.auth.getUser();
    if (!data?.user) throw new Error("Auth: Kein User nach Login");

    return data.user;
  }

  async function setupProfileAndSlots(user, startIso) {
    const zielDatum = addDays(startIso, 16 * 7);

    log("Schritt 1: Testnutzer-Profil wird gesetzt …");
    await apiJson(
      "/api/profile/update",
      {
        method: "POST",
        body: {
          vorname: "Test Läufer",
          geschlecht: "maennlich",
          alter_jahre: 28,
          gewicht_kg: 72,
          koerperfettanteil: 15,
          stadt: "München",
          land: "DE",
          latitude: 48.1351,
          longitude: 11.582,
          fitnesslevel: "hobby",
          ziel: "halbmarathon",
          ziel_datum: zielDatum,
          onboarding_abgeschlossen: true,
        },
      },
      startIso
    );

    log("Trainingsslots werden gesetzt (Di/Do/Sa) …");
    await apiJson(
      "/api/training-slots",
      {
        method: "PUT",
        body: {
          slots: [
            { wochentag: 1, verfuegbar: true, uhrzeit_start: "17:00", uhrzeit_ende: "18:00" }, // Di
            { wochentag: 3, verfuegbar: true, uhrzeit_start: "17:00", uhrzeit_ende: "18:00" }, // Do
            { wochentag: 5, verfuegbar: true, uhrzeit_start: "09:00", uhrzeit_ende: "11:00" }, // Sa
          ],
        },
      },
      startIso
    );

    reportRef.current.meta = {
      testUserId: user.id,
      email: user.email,
      zielDatum,
      startIso,
    };
  }

  async function generatePlan(simIso) {
    const res = await apiJson(
      "/api/training-plan",
      { method: "POST", body: { generate: true, days: 14 } },
      simIso
    );
    return res;
  }

  async function getPlanWeek(simIso, days = 7) {
    const res = await apiJson(`/api/training-plan?days=${days}`, { method: "GET" }, simIso);
    return res.plan || [];
  }

  async function updatePlanStatus(entry, status, simIso) {
    await apiJson(
      "/api/training-plan",
      { method: "PATCH", body: { id: entry.id, status } },
      simIso
    );
  }

  async function insertSimRun(userId, simIso, plannedEntry) {
    const baseDist = Number(plannedEntry?.distanz_km) || 6;
    const dist = Math.round(baseDist * rand(0.9, 1.1) * 10) / 10;
    const paceSec = rand(300, 390); // 5:00 - 6:30
    const { paceStr } = asPaceString(paceSec);
    const avgHr = Math.round(rand(140, 165));
    const maxHr = Math.min(195, avgHr + Math.round(rand(5, 18)));
    const feeling = Math.floor(rand(3, 6)); // 3-5

    // created_at: simIso + zufällige Uhrzeit
    const dt = new Date(simIso);
    dt.setHours(Math.floor(rand(6, 20)), Math.floor(rand(0, 60)), 0, 0);

    const payload = {
      user_id: userId,
      distanz_km: dist,
      pace: paceStr,
      herzfrequenz: avgHr,
      herzfrequenz_max: maxHr,
      befinden: feeling,
      notizen: `Simulation: ${plannedEntry.trainingstyp}`,
      created_at: dt.toISOString(),
    };

    const { error } = await supabase.from("runs").insert(payload);
    if (error) {
      // Fallback: API (ohne created_at)
      const [min, sec] = paceStr.split(":").map(Number);
      await apiJson(
        "/api/runs",
        {
          method: "POST",
          body: {
            distanceKm: dist,
            paceMin: min,
            paceSec: sec,
            heartRateAvg: avgHr,
            heartRateMax: maxHr,
            feeling,
            notes: payload.notizen,
          },
        },
        simIso
      );
    }
  }

  async function chatOnce(message, simIso) {
    const res = await apiJson(
      "/api/chat",
      { method: "POST", body: { messages: [{ role: "user", content: message }] } },
      simIso
    );
    return res;
  }

  function addCheck(bucket, name, pass, details = "") {
    reportRef.current[bucket].push({ name, pass, details });
  }

  async function runSimulation() {
    setRunning(true);
    setProgress(0);
    setLogs([]);
    setReport(null);
    reportRef.current = {
      meta: {},
      planChecks: [],
      coachChecks: [],
      actionChecks: [],
      chatTranscripts: [],
      weekLogs: [],
    };

    const totalSteps = 1 + 1 + 8 * 3 + 1; // Setup + initial Plan + (8 Wochen: train+chat+regen) + Report
    let step = 0;

    try {
      const startIso = isoDate(new Date());

      log("Simulation startet …");
      const user = await ensureTestUser();
      step++;
      updateProgress(step, totalSteps);

      await setupProfileAndSlots(user, startIso);
      step++;
      updateProgress(step, totalSteps);

      // Schritt 2 – Plan generieren + Makro-Checks
      log("Schritt 2: Generiere Trainingsplan (Makro-Skelett) …");
      const gen0 = await generatePlan(startIso);
      const makro = gen0.makro_skelett || [];
      const macroInfo = computeMacroChecks(makro);
      reportRef.current.meta.totalWeeks = macroInfo.totalWeeks;

      log(`Plan generiert für ${macroInfo.totalWeeks} Wochen`);
      log(
        `Wochenvolumen W1/W8/W14: ${macroInfo.week1?.wochenvolumen_km ?? "?"} / ${
          macroInfo.week8?.wochenvolumen_km ?? "?"
        } / ${macroInfo.week14?.wochenvolumen_km ?? "?"} km`
      );
      for (const c of macroInfo.checks) {
        addCheck("planChecks", c.name, c.pass, c.details);
        log(`${c.pass ? "✓" : "✗"} ${c.name}${c.details ? ` (${c.details})` : ""}`);
      }

      step++;
      updateProgress(step, totalSteps);

      // Schritt 3 – 8 Wochen Simulation
      const weekPrompts = [
        "Was ist mein Plan für diese Woche?",
        "Ich kann heute nicht trainieren",
        "Ich bin diese Woche müde",
        "Was ist eine Deload-Woche?",
        "Mein Knie schmerzt",
        "Wie weit bin ich von meinem Ziel entfernt?",
        "Ich habe heute spontan 30 Minuten Zeit",
        "Mein Gewicht ist jetzt 70kg",
      ];

      for (let w = 1; w <= 8; w++) {
        const simIso = addDays(startIso, (w - 1) * 7);
        log(`\n=== Woche ${w} (Sim-Datum: ${simIso}) ===`);

        // a) Plan für diese Woche sicherstellen + holen
        await generatePlan(simIso);
        const plan7 = await getPlanWeek(simIso, 7);
        const trainingEntries = (plan7 || []).filter((e) => e.trainingstyp && e.trainingstyp !== "pause");
        log(`Geplante Einheiten: ${trainingEntries.length}`);

        // a) 80/20 absolvieren/überspringen + Runs eintragen
        const { completed, skipped } = pick80_20(trainingEntries);
        for (const e of completed) {
          await updatePlanStatus(e, "abgeschlossen", simIso);
          await insertSimRun(user.id, simIso, e);
        }
        for (const e of skipped) {
          await updatePlanStatus(e, "uebersprungen", simIso);
        }
        reportRef.current.weekLogs.push({
          week: w,
          simulatedDate: simIso,
          planned: trainingEntries.length,
          completed: completed.length,
          skipped: skipped.length,
        });
        step++;
        updateProgress(step, totalSteps);

        // b) Coach-Interaktion
        const prompt = weekPrompts[w - 1];
        log(`Chat-Test: "${prompt}"`);
        const chat = await chatOnce(prompt, simIso);
        const reply = chat.reply || "";
        reportRef.current.chatTranscripts.push({
          week: w,
          simulatedDate: simIso,
          prompt,
          reply,
          action: chat.action || null,
        });

        // Checks pro Woche
        if (w === 1) {
          addCheck("coachChecks", "Antwort enthält konkrete Distanzen", hasDistance(reply), "");
          addCheck("coachChecks", "Antwort enthält HF-Zonen oder RPE", hasZonesOrRpe(reply), "");
        }
        if (w === 2) {
          const planAdjusted = chat.action?.type === "plan_day_updated";
          addCheck("coachChecks", "Coach passt Plan an", planAdjusted, chat.action?.type || "");
          addCheck("actionChecks", "update_single_day ausgelöst", planAdjusted, chat.action?.type || "");
        }
        if (w === 3) {
          addCheck("coachChecks", "Coach erwähnt Regeneration", /regen/i.test(reply), "");
          addCheck("coachChecks", "Coach reduziert Intensität (Hinweis)", /(locker|reduzier|weniger intensiv|pause)/i.test(reply), "");
        }
        if (w === 4) {
          addCheck("coachChecks", "Deload korrekt erklärt", /(deload|entlast|volumen|30%)/i.test(reply), "");
          addCheck("coachChecks", "Coach bezieht sich auf Deload-Kontext", /(diese woche|aktuell).*(deload|entlast)/i.test(reply), "");
        }
        if (w === 5) {
          addCheck("coachChecks", "Coach warnt vor Übertraining", /(übertraining|belastung|pause|reduz)/i.test(reply), "");
          addCheck("coachChecks", "Coach empfiehlt Arztbesuch", /(arzt|ärzt)/i.test(reply), "");
          addCheck("coachChecks", "Coach reduziert Trainingsplan (Hinweis)", /(reduz|pause|regeneration)/i.test(reply), "");
        }
        if (w === 6) {
          addCheck("coachChecks", "Coach nennt verbleibende Wochen", /(wochen)/i.test(reply), "");
          addCheck("coachChecks", "Coach Einschätzung wirkt realistisch", /(realistisch|machbar|konservativ|schritt)/i.test(reply), "");
        }
        if (w === 7) {
          addCheck("coachChecks", "Coach schlägt konkretes Training vor", hasDistance(reply) || /\bmin\b/i.test(reply), "");
          addCheck("coachChecks", "Coach berücksichtigt 30 Minuten", /(30\s?min)/i.test(reply), "");
        }
        if (w === 8) {
          const profUpdated = chat.action?.type === "profile_updated";
          addCheck("actionChecks", "update_profile ausgelöst", profUpdated, chat.action?.type || "");
        }

        log("Coach-Antwort:", reply);
        if (chat.action) log("Action:", chat.action);

        step++;
        updateProgress(step, totalSteps);

        // c) Nach jeder Woche: nächster Plan-Refresh + Volumen-Log aus Makro
        const genNext = await generatePlan(addDays(simIso, 7));
        const macro = genNext.makro_skelett || makro;
        const macroWeek = Array.isArray(macro)
          ? macro.find((x) => x.startDatum <= simIso && x.endDatum >= simIso)
          : null;
        if (macroWeek) {
          log(`Makro-Woche ${macroWeek.woche}: ${macroWeek.phase}/${macroWeek.mesozyklus}, Vol ${macroWeek.wochenvolumen_km}km`);
        }

        step++;
        updateProgress(step, totalSteps);
      }

      // Schritt 4 – Auswertung
      const planChecks = reportRef.current.planChecks;
      const coachChecks = reportRef.current.coachChecks;
      const actionChecks = reportRef.current.actionChecks;

      const flatten = (arr) => arr.filter((x) => x && x.name);
      const allChecks = [...flatten(planChecks), ...flatten(coachChecks), ...flatten(actionChecks)];
      const passed = allChecks.filter((c) => c.pass).length;
      const total = allChecks.length;

      const finalReport = {
        meta: reportRef.current.meta,
        summary: {
          passed,
          total,
        },
        sections: {
          trainingsplan_logik: planChecks,
          coach_intelligenz: coachChecks,
          datenbank_actions: actionChecks,
        },
        weekLogs: reportRef.current.weekLogs,
        chatTranscripts: reportRef.current.chatTranscripts,
      };

      setReport(finalReport);
      step++;
      updateProgress(step, totalSteps);
      log(`\nFERTIG: ${passed}/${total} Tests ✓`);
    } catch (e) {
      log(`FEHLER: ${e.message}`);
      setReport({
        error: e.message,
        partial: reportRef.current,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-surface p-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
          Test-Simulation (Development)
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Zeitraffer-Simulation eines Testnutzers über 8 Wochen. Alle Calls laufen im Browser
          gegen /api/* mit 500ms Delay.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            disabled={running}
            onClick={runSimulation}
            className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {running ? "Simulation läuft …" : "Simulation starten"}
          </button>

          {report ? (
            <div className="flex gap-2">
              <button
                onClick={() => downloadJson("pacemind-test-report.json", report)}
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text hover:bg-surface-elevated"
              >
                Report als JSON exportieren
              </button>
              <button
                onClick={() =>
                  downloadJson(
                    "pacemind-chat-transcripts.json",
                    report?.chatTranscripts || []
                  )
                }
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-text hover:bg-surface-elevated"
              >
                Alle Coach-Antworten exportieren
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#1b1b1b]">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">{progress}%</p>
        </div>
      </div>

      {report ? (
        <div className="rounded-md border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-text">PACEMIND TEST REPORT</h2>
          {report.error ? (
            <p className="mt-2 text-sm text-accent">Fehler: {report.error}</p>
          ) : (
            <p className="mt-2 text-sm text-text-muted">
              Gesamtergebnis: {report.summary.passed}/{report.summary.total} Tests ✓
            </p>
          )}

          {!report.error ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                ["Trainingsplan-Logik", report.sections.trainingsplan_logik],
                ["Coach-Intelligenz", report.sections.coach_intelligenz],
                ["Datenbank-Actions", report.sections.datenbank_actions],
              ].map(([title, rows]) => (
                <div key={title} className="rounded-md border border-border bg-surface-elevated p-4">
                  <p className="font-semibold text-text">{title}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(rows || []).map((r, idx) => (
                      <li key={idx} className="text-text-muted">
                        <span className={r.pass ? "text-emerald-400" : "text-accent"}>
                          {r.pass ? "✓" : "✗"}
                        </span>{" "}
                        {r.name}
                        {r.details ? (
                          <span className="text-xs text-text-muted"> — {r.details}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-text">
              Alle Coach-Antworten anzeigen
            </summary>
            <div className="mt-3 space-y-4">
              {(report.chatTranscripts || []).map((t) => (
                <div key={`${t.week}-${t.prompt}`} className="rounded-md border border-border bg-bg p-4">
                  <p className="text-sm font-semibold text-text">
                    Woche {t.week} ({t.simulatedDate})
                  </p>
                  <p className="mt-2 text-xs text-text-muted">Prompt:</p>
                  <pre className="whitespace-pre-wrap text-sm text-text">{t.prompt}</pre>
                  <p className="mt-2 text-xs text-text-muted">Antwort:</p>
                  <pre className="whitespace-pre-wrap text-sm text-text">{t.reply}</pre>
                  {t.action ? (
                    <>
                      <p className="mt-2 text-xs text-text-muted">Action:</p>
                      <pre className="whitespace-pre-wrap text-xs text-text-muted">
                        {JSON.stringify(t.action, null, 2)}
                      </pre>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-surface p-6">
        <h2 className="text-lg font-bold text-text">Live-Log</h2>
        <div className="mt-3 max-h-[520px] overflow-auto rounded-md border border-border bg-bg p-4">
          <pre className="whitespace-pre-wrap text-xs text-text-muted">
            {logs.map((l) => `[${l.ts}] ${l.line}`).join("\n")}
          </pre>
        </div>
      </div>
    </div>
  );
}

