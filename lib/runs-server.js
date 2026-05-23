import { mapDbRunToApp } from "./runs";

const CONTEXT_LIMIT = 5;

export async function getRunsForUser(supabase, userId) {
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbRunToApp);
}

export async function getRecentRunsForContext(supabase, userId) {
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(CONTEXT_LIMIT);

  if (error) throw error;
  return (data || []).map(mapDbRunToApp);
}

export async function insertRun(supabase, userId, payload) {
  const { data, error } = await supabase
    .from("runs")
    .insert({
      user_id: userId,
      distanz_km: payload.distanz_km,
      pace: payload.pace,
      herzfrequenz: payload.herzfrequenz,
      herzfrequenz_max: payload.herzfrequenz_max,
      befinden: payload.befinden,
      notizen: payload.notizen || "",
    })
    .select()
    .single();

  if (error) throw error;
  return mapDbRunToApp(data);
}

export async function deleteRunForUser(supabase, userId, runId) {
  const { error } = await supabase
    .from("runs")
    .delete()
    .eq("id", runId)
    .eq("user_id", userId);

  if (error) throw error;
}
