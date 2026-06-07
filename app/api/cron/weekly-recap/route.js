import Groq from "groq-sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function requireCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // optional in development
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  return null;
}

function getPastWeekRange(today = new Date()) {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const jsDay = d.getDay(); // 0=So, 1=Mo, ..., 6=Sa
  // Wir wollen den Bereich von Montag dieser Woche bis Sonntag (heute)
  const daysSinceMon = jsDay === 0 ? 6 : jsDay - 1;

  const start = new Date(d);
  start.setDate(d.getDate() - daysSinceMon);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const iso = (x) => x.toISOString().split("T")[0];
  return { startIso: iso(start), endIso: iso(end), start, end };
}

function paceToSeconds(paceStr) {
  if (!paceStr || typeof paceStr !== "string") return 0;
  const parts = paceStr.split(":");
  if (parts.length < 2) return 0;
  const min = parseInt(parts[0], 10) || 0;
  const sec = parseInt(parts[1], 10) || 0;
  return min * 60 + sec;
}

function secondsToPace(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "-";
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export async function GET(request) {
  try {
    const authResp = requireCron(request);
    if (authResp) return authResp;

    const supabase = createAdminClient();
    const apiKey = process.env.GROQ_API_KEY;
    const { startIso, endIso, start } = getPastWeekRange();

    // Alle Nutzerprofile abrufen
    const { data: profiles, error: profsErr } = await supabase
      .from("profiles")
      .select("id, vorname");
    
    if (profsErr) throw profsErr;

    const results = [];

    for (const profile of profiles || []) {
      const userId = profile.id;
      const userName = profile.vorname || "Runner";

      // 1. Läufe der Woche abrufen
      const { data: runs, error: runsErr } = await supabase
        .from("runs")
        .select("distanz_km, pace, created_at")
        .eq("user_id", userId)
        .gte("created_at", `${startIso}T00:00:00.000Z`)
        .lte("created_at", `${endIso}T23:59:59.999Z`);

      if (runsErr) {
        console.error(`Runs error for ${userId}:`, runsErr);
        continue;
      }

      // 2. Trainingsplan der Woche abrufen
      const { data: plans, error: plansErr } = await supabase
        .from("training_plan")
        .select("distanz_km, status, datum")
        .eq("user_id", userId)
        .gte("datum", startIso)
        .lte("datum", endIso);

      if (plansErr) {
        console.error(`Plans error for ${userId}:`, plansErr);
        continue;
      }

      // 3. Berechnungen durchführen
      const gelaufeneKm = runs ? runs.reduce((sum, r) => sum + (Number(r.distanz_km) || 0), 0) : 0;
      const geplanteKm = plans ? plans.reduce((sum, p) => sum + (Number(p.distanz_km) || 0), 0) : 0;
      const anzahlLaeufe = runs ? runs.length : 0;

      // Durchschnittspace berechnen
      let totalSeconds = 0;
      let totalDistanceForPace = 0;
      for (const r of runs || []) {
        const dist = Number(r.distanz_km) || 0;
        const paceSec = paceToSeconds(r.pace);
        if (dist > 0 && paceSec > 0) {
          totalSeconds += paceSec * dist;
          totalDistanceForPace += dist;
        }
      }
      const avgPaceSec = totalDistanceForPace > 0 ? (totalSeconds / totalDistanceForPace) : 0;
      const durchschnittspace = secondsToPace(avgPaceSec);

      // 4. Streak berechnen (Prüfe die Vorwoche)
      const prevStart = new Date(start);
      prevStart.setDate(start.getDate() - 7);
      const prevStartIso = prevStart.toISOString().split("T")[0];

      const { data: prevRecap, error: prevErr } = await supabase
        .from("weekly_recaps")
        .select("streak_wochen")
        .eq("user_id", userId)
        .eq("woche_start", prevStartIso)
        .maybeSingle();

      let streakWochen = 0;
      if (anzahlLaeufe > 0) {
        streakWochen = prevRecap ? (prevRecap.streak_wochen || 0) + 1 : 1;
      } else {
        streakWochen = 0;
      }

      // 5. Coach-Kommentar mit Groq generieren
      let coachKommentar = "";
      if (apiKey) {
        const groq = new Groq({ apiKey });
        const prompt = `Du bist ein erfahrener, motivierender KI-Laufcoach und verhältst dich wie ein echter Personal Trainer der PerformanceProtokoll-Community.
Schreibe eine kurze, persönliche Wochenzusammenfassung (Fortschritts-Recap) für deinen Athleten ${userName}.
Hier sind die Trainingsdaten der vergangenen Woche (Montag bis Sonntag):
- Gelaufene Kilometer: ${gelaufeneKm.toFixed(1)} km (Geplant waren: ${geplanteKm.toFixed(1)} km)
- Anzahl der absolvierten Läufe: ${anzahlLaeufe}
- Durchschnittliche Pace: ${durchschnittspace} min/km
- Aktueller Wochen-Streak: ${streakWochen} Wochen aktiv in Folge

Regeln:
1. Antworte in Deutsch.
2. Halte dich extrem kurz: Maximal 1 bis 2 motivierende Sätze.
3. Beziehe dich direkt auf die Daten (z.B. ob das Kilometerziel erreicht wurde oder lobe den Streak).
4. Schreibe direkt, sportlich-athletisch, wertschätzend und motivierend. Keine Floskeln oder Smalltalk drumherum.`;

        try {
          const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Du bist ein professioneller, motivierender Laufcoach und Personal Trainer der PerformanceProtokoll-Community." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
          });
          coachKommentar = completion.choices[0]?.message?.content?.trim() || "";
        } catch (e) {
          console.error(`Groq error for user ${userId}:`, e);
          coachKommentar = anzahlLaeufe > 0 
            ? `Starke Leistung diese Woche mit ${anzahlLaeufe} Läufen über ${gelaufeneKm.toFixed(1)} km! Bleib weiter so ehrgeizig dabei.`
            : `Diese Woche gab es keine Läufe. Ruh dich aus, regeneriere und greif nächste Woche wieder an!`;
        }
      } else {
        coachKommentar = anzahlLaeufe > 0 
          ? `Starke Leistung diese Woche mit ${anzahlLaeufe} Läufen über ${gelaufeneKm.toFixed(1)} km! Bleib weiter so ehrgeizig dabei.`
          : `Diese Woche gab es keine Läufe. Ruh dich aus, regeneriere und greif nächste Woche wieder an!`;
      }

      // 6. Recap in Supabase speichern (Upsert-Logik)
      const { data: existing } = await supabase
        .from("weekly_recaps")
        .select("id")
        .eq("user_id", userId)
        .eq("woche_start", startIso)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase
          .from("weekly_recaps")
          .update({
            gelaufene_km: gelaufeneKm,
            geplante_km: geplanteKm,
            anzahl_läufe: anzahlLaeufe,
            durchschnittspace: durchschnittspace,
            streak_wochen: streakWochen,
            coach_kommentar: coachKommentar
          })
          .eq("id", existing.id);
        
        if (updateErr) console.error(`Error updating recap for ${userId}:`, updateErr);
      } else {
        const { error: insertErr } = await supabase
          .from("weekly_recaps")
          .insert({
            user_id: userId,
            woche_start: startIso,
            gelaufene_km: gelaufeneKm,
            geplante_km: geplanteKm,
            anzahl_läufe: anzahlLaeufe,
            durchschnittspace: durchschnittspace,
            streak_wochen: streakWochen,
            coach_kommentar: coachKommentar
          });

        if (insertErr) console.error(`Error inserting recap for ${userId}:`, insertErr);
      }

      results.push({
        userId,
        userName,
        gelaufeneKm,
        geplanteKm,
        anzahlLaeufe,
        durchschnittspace,
        streakWochen,
        coachKommentar
      });
    }

    return Response.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error("weekly-recap cron error:", error);
    return Response.json(
      { error: error.message || "Cron fehlgeschlagen" },
      { status: 500 }
    );
  }
}
