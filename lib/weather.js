const WMO_DESCRIPTIONS = {
  0: "Klar",
  1: "Überwiegend klar",
  2: "Teilweise bewölkt",
  3: "Bewölkt",
  45: "Nebel",
  48: "Nebel mit Reifbildung",
  51: "Leichter Nieselregen",
  53: "Nieselregen",
  55: "Starker Nieselregen",
  61: "Leichter Regen",
  63: "Regen",
  65: "Starker Regen",
  71: "Leichter Schneefall",
  73: "Schneefall",
  75: "Starker Schneefall",
  80: "Regenschauer",
  81: "Regenschauer",
  82: "Starke Regenschauer",
  95: "Gewitter",
};

export function describeWeatherCode(code) {
  return WMO_DESCRIPTIONS[code] ?? "Wechselhaft";
}

export function weatherEmoji(code) {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2 || code === 3) return "⛅";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  if (code === 45 || code === 48) return "🌫️";
  return "🌤️";
}

export async function fetchCurrentWeather(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weathercode,windspeed_10m,precipitation"
  );
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error("Wetterdaten konnten nicht geladen werden");

  const data = await res.json();
  return data.current;
}

export async function fetchDailyForecast(latitude, longitude, days = 14) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(days));

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error("Wettervorhersage konnte nicht geladen werden");

  const data = await res.json();
  const { time, weathercode, temperature_2m_max, temperature_2m_min } =
    data.daily;

  return time.map((date, i) => ({
    date,
    weathercode: weathercode[i],
    tempMax: temperature_2m_max[i],
    tempMin: temperature_2m_min[i],
    temp: Math.round((temperature_2m_max[i] + temperature_2m_min[i]) / 2),
  }));
}

export function getForecastForDate(forecast, dateStr) {
  return forecast?.find((d) => d.date === dateStr) || null;
}

export async function getExtendedWeatherContext(profile) {
  if (profile?.latitude == null || profile?.longitude == null) {
    return null;
  }

  try {
    const [current, daily] = await Promise.all([
      fetchCurrentWeather(profile.latitude, profile.longitude),
      fetchDailyForecast(profile.latitude, profile.longitude, 14),
    ]);

    const tomorrow = daily[1] || daily[0];

    return {
      current,
      tomorrow,
      daily,
      location: { stadt: profile.stadt, land: profile.land },
    };
  } catch (error) {
    console.error("Extended weather error:", error);
    return null;
  }
}

export function formatWeatherForPrompt(weatherContext) {
  if (!weatherContext?.current) {
    return "Keine Wetterdaten verfügbar.";
  }

  const { current, tomorrow, location } = weatherContext;
  const ort = location?.land
    ? `${location.stadt}, ${location.land}`
    : location?.stadt || "Standort";

  const todayLines = [
    `Heute (${ort}):`,
    `Temperatur: ${current.temperature_2m}°C`,
    `Wetter: ${describeWeatherCode(current.weathercode)}`,
    `Wind: ${current.windspeed_10m} km/h`,
    `Niederschlag: ${current.precipitation} mm`,
  ];

  const tomorrowLines = tomorrow
    ? [
        `Morgen:`,
        `Temperatur: ca. ${tomorrow.temp}°C (${tomorrow.tempMin}–${tomorrow.tempMax}°C)`,
        `Wetter: ${describeWeatherCode(tomorrow.weathercode)}`,
      ]
    : [];

  return [...todayLines, ...tomorrowLines].join("\n");
}
