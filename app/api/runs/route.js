import { createClient } from "@/lib/supabase/server";
import { getRunsForUser, insertRun } from "@/lib/runs-server";
import { paceToString } from "@/lib/runs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const runs = await getRunsForUser(supabase, user.id);
    return Response.json({ runs }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Runs GET error:", error);
    return Response.json(
      { error: error.message || "Läufe konnten nicht geladen werden" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const body = await request.json();
    const {
      distanceKm,
      paceMin,
      paceSec,
      heartRateAvg,
      heartRateMax,
      feeling,
      notes,
      sportArt,
    } = body;

    const distance = Number(distanceKm);
    if (distance < 1) {
      return Response.json(
        { error: "Die Distanz muss mindestens 1 km betragen." },
        { status: 400 }
      );
    }

    const paceMinNum = Number(paceMin);
    const paceSecNum = Number(paceSec);
    const paceInMinutes = paceMinNum + paceSecNum / 60;

    if (paceInMinutes < 2.25) {
      return Response.json(
        { error: "Diese Pace scheint unrealistisch schnell zu sein — bitte überprüfe deine Eingabe." },
        { status: 400 }
      );
    }
    if (paceInMinutes > 12) {
      return Response.json(
        { error: "Diese Pace scheint unrealistisch langsam zu sein — bitte überprüfe deine Eingabe." },
        { status: 400 }
      );
    }

    const durationMinutes = distance * paceInMinutes;
    if (durationMinutes > 720) {
      return Response.json(
        { error: "Die Gesamtdauer ist zu lang — maximal 12 Stunden pro Eintrag." },
        { status: 400 }
      );
    }

    const run = await insertRun(supabase, user.id, {
      distanz_km: distance,
      pace: paceToString(paceMin, paceSec),
      herzfrequenz: heartRateAvg ? Number(heartRateAvg) : null,
      herzfrequenz_max: heartRateMax ? Number(heartRateMax) : null,
      befinden: Number(feeling),
      notizen: notes || "",
      sport_art: sportArt || "laufen",
    });

    return Response.json({ run }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Runs POST error:", error);
    return Response.json(
      { error: error.message || "Lauf konnte nicht gespeichert werden" },
      { status: 500 }
    );
  }
}
