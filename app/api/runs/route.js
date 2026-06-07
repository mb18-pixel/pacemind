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
    } = body;

    const run = await insertRun(supabase, user.id, {
      distanz_km: Number(distanceKm),
      pace: paceToString(paceMin, paceSec),
      herzfrequenz: heartRateAvg ? Number(heartRateAvg) : null,
      herzfrequenz_max: heartRateMax ? Number(heartRateMax) : null,
      befinden: Number(feeling),
      notizen: notes || "",
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
