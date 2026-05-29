import { getExtendedWeatherContext } from "./weather";

export async function getProfileForUser(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getProfileWeatherContext(profile) {
  return getExtendedWeatherContext(profile);
}
