import { createClient } from "@/lib/supabase/server";
import { fetchDailyForecast } from "@/lib/weather";
import { getProfileForUser } from "@/lib/profile-server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const profile = await getProfileForUser(supabase, user.id).catch(
      () => null
    );

    if (!profile?.latitude || !profile?.longitude) {
      return Response.json({ forecast: [] });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "14", 10);

    const forecast = await fetchDailyForecast(
      profile.latitude,
      profile.longitude,
      days
    );

    return Response.json({ forecast });
  } catch (error) {
    console.error("Weather API error:", error);
    return Response.json(
      { error: error.message || "Wetter konnte nicht geladen werden" },
      { status: 500 }
    );
  }
}
