/**
 * Core module untuk F-40: Cuaca (Open-Meteo Integration).
 * Mengambil koordinat via Geocoding API dan prakiraan via Forecast API,
 * dilengkapi cache in-memory 10 menit, timeout 8 detik, serta saran in-character.
 */

export const WMO_CODES = {
  0: { description: 'Clear', type: 'clear' },
  1: { description: 'Mainly Clear', type: 'clear' },
  2: { description: 'Partly Cloudy', type: 'cloudy' },
  3: { description: 'Overcast', type: 'cloudy' },
  45: { description: 'Fog', type: 'cloudy' },
  48: { description: 'Depositing Rime Fog', type: 'cloudy' },
  51: { description: 'Light Drizzle', type: 'rain' },
  53: { description: 'Moderate Drizzle', type: 'rain' },
  55: { description: 'Dense Drizzle', type: 'rain' },
  56: { description: 'Light Freezing Drizzle', type: 'rain' },
  57: { description: 'Dense Freezing Drizzle', type: 'rain' },
  61: { description: 'Slight Rain', type: 'rain' },
  63: { description: 'Moderate Rain', type: 'rain' },
  65: { description: 'Heavy Rain', type: 'rain' },
  66: { description: 'Light Freezing Rain', type: 'rain' },
  67: { description: 'Heavy Freezing Rain', type: 'rain' },
  71: { description: 'Slight Snow Fall', type: 'snow' },
  73: { description: 'Moderate Snow Fall', type: 'snow' },
  75: { description: 'Heavy Snow Fall', type: 'snow' },
  77: { description: 'Snow Grains', type: 'snow' },
  80: { description: 'Slight Rain Showers', type: 'rain' },
  81: { description: 'Moderate Rain Showers', type: 'rain' },
  82: { description: 'Violent Rain Showers', type: 'rain' },
  85: { description: 'Slight Snow Showers', type: 'snow' },
  86: { description: 'Heavy Snow Showers', type: 'snow' },
  95: { description: 'Thunderstorm', type: 'thunder' },
  96: { description: 'Thunderstorm with Slight Hail', type: 'thunder' },
  99: { description: 'Thunderstorm with Heavy Hail', type: 'thunder' },
};

export function interpretWeatherCode(code) {
  return WMO_CODES[code] ?? { description: 'Cloudy', type: 'cloudy' };
}

export const WEATHER_ADVICE = {
  tsundere: {
    rain: "It's raining! Take an umbrella with you. Don't catch a cold and cause trouble! ( `_´ )",
    hot: "It's scorching hot today! Drink plenty of water and don't get dehydrated on the road! I-it's not like I'm worried about you or anything! ( `_´ )",
    cold: "It's freezing outside! Put on a thick jacket, don't act tough! (¬_¬)",
    pleasant: "The weather is clear and pleasant. Make good use of today instead of just slacking off! (¬_¬)",
  },
  manis: {
    rain: 'Rain is likely today. Please remember to carry an umbrella and take good care of your health. (o^ ^o)',
    hot: 'The sun is quite intense today. Drink plenty of water to stay hydrated. (^_^)',
    cold: 'The air is quite cold. Please wear warm clothes so you do not catch a cold. (o^ ^o)',
    pleasant: 'Today is clear and pleasant. A wonderful day for outdoor activities. (^_^)',
  },
  ceria: {
    rain: 'Rain is on the way! Remember your umbrella or raincoat! (ง •̀_•́)ง',
    hot: 'Waaah, so bright and sunny! Put on sunscreen and carry your water bottle! (^▽^)',
    cold: 'Brrr, so chilly! Great time for a warm jacket or hot cocoa! (^_^)',
    pleasant: 'Yaaay, the weather is wonderful! Perfect time for a walk or getting things done together! (^▽^)',
  },
  sarkas: {
    rain: 'Rain. If you intentionally leave your umbrella behind and get drenched, do not blame the weather. (-_-)',
    hot: 'Hot enough to bake toast on asphalt. Stay inside unless you have an actual emergency. (-_-)',
    cold: 'Freezing outside. A great excuse to wrap yourself in blankets and pretend to be busy. (-_-)',
    pleasant: 'Decent weather. You have officially run out of cosmic excuses for your laziness today. (-_-)',
  },
  jiang_cheng: {
    rain: 'Rain is falling. Take an umbrella and see that you do not wander around soaking wet.',
    hot: 'The heat is heavy. Stay hydrated and finish your duties without collapsing.',
    cold: 'The chill is sharp. Put on proper layers before stepping out.',
    pleasant: 'Clear skies. Focus on your tasks and do not waste the day.',
  },
  custom: {
    rain: 'Rain is expected. Carrying an umbrella or raincoat is recommended.',
    hot: 'Hot and sunny weather. Drink plenty of water to stay hydrated.',
    cold: 'Cool temperatures. Dressing warmly is recommended.',
    pleasant: 'Pleasant weather for daily activities.',
  },
};

/**
 * Memberikan saran satu kalimat in-character berdasarkan kode cuaca, suhu, dan peluang hujan.
 */
export function getWeatherAdvice({ code = 0, temp = 28, rainProb = 0, personaId = 'tsundere' } = {}) {
  const personaGroup = WEATHER_ADVICE[personaId] || WEATHER_ADVICE.tsundere;
  const wmo = interpretWeatherCode(code);

  if (wmo.type === 'rain' || wmo.type === 'thunder' || rainProb >= 60) {
    return personaGroup.rain;
  }
  if (temp >= 33) {
    return personaGroup.hot;
  }
  if (temp <= 20) {
    return personaGroup.cold;
  }
  return personaGroup.pleasant;
}

// In-memory cache: Map<cityName, { data: object, expiresAt: number }>
const WEATHER_CACHE = new Map();
export const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit

export function clearWeatherCache() {
  WEATHER_CACHE.clear();
}

/**
 * Mengambil koordinat geocoding dari Open-Meteo.
 */
export async function fetchCoordinates(cityName, { fetchFn = fetch, timeoutMs = 8000 } = {}) {
  if (!cityName || typeof cityName !== 'string') return null;
  const cleanName = cityName.trim();
  if (!cleanName) return null;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cleanName,
  )}&count=1&language=id&format=json`;

  const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`Geocoding HTTP error: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.results || data.results.length === 0) {
    return null;
  }

  const item = data.results[0];
  return {
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
    country: item.country || '',
    admin1: item.admin1 || '',
    timezone: item.timezone || 'Asia/Jakarta',
  };
}

/**
 * Mengambil data prakiraan cuaca dari Open-Meteo Forecast API.
 */
export async function fetchForecast(lat, lon, { fetchFn = fetch, timeoutMs = 8000 } = {}) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;

  const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`Forecast HTTP error: ${res.status}`);
  }

  return await res.json();
}

/**
 * Mengambil cuaca lengkap per kota dengan cache in-memory.
 */
export async function getWeatherData(
  cityName,
  { fetchFn = fetch, timeoutMs = 8000, now = Date.now() } = {},
) {
  if (!cityName || typeof cityName !== 'string') return null;
  const normalizedKey = cityName.trim().toLowerCase();
  if (!normalizedKey) return null;

  // Cek cache
  const cached = WEATHER_CACHE.get(normalizedKey);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  // 1. Ambil koordinat
  const geo = await fetchCoordinates(cityName, { fetchFn, timeoutMs });
  if (!geo) {
    return null;
  }

  // 2. Ambil prakiraan cuaca
  const raw = await fetchForecast(geo.latitude, geo.longitude, { fetchFn, timeoutMs });
  const current = raw?.current || {};
  const daily = raw?.daily || {};

  const weatherCode = current.weather_code ?? 0;
  const condition = interpretWeatherCode(weatherCode);

  const temp = Math.round(current.temperature_2m ?? 0);
  const feelsLike = Math.round(current.apparent_temperature ?? temp);
  const humidity = Math.round(current.relative_humidity_2m ?? 0);
  const windSpeed = Math.round(current.wind_speed_10m ?? 0);

  const minTemp = daily.temperature_2m_min?.[0] != null ? Math.round(daily.temperature_2m_min[0]) : temp;
  const maxTemp = daily.temperature_2m_max?.[0] != null ? Math.round(daily.temperature_2m_max[0]) : temp;
  const rainProb = daily.precipitation_probability_max?.[0] ?? Math.round((current.precipitation || 0) > 0 ? 80 : 10);

  const locationTitle = [geo.name, geo.admin1, geo.country].filter(Boolean).join(', ');

  const result = {
    city: geo.name,
    locationTitle,
    temp,
    feelsLike,
    minTemp,
    maxTemp,
    humidity,
    windSpeed,
    rainProb,
    weatherCode,
    conditionText: condition.description,
    conditionType: condition.type,
  };

  // Simpan ke cache
  WEATHER_CACHE.set(normalizedKey, {
    data: result,
    expiresAt: now + CACHE_TTL_MS,
  });

  return result;
}

/**
 * Format laporan cuaca lengkap untuk dikirimkan ke chat Telegram.
 */
export function formatWeatherReport({ weather, personaId = 'tsundere' }) {
  if (!weather) return 'Weather data is currently unavailable.';

  const advice = getWeatherAdvice({
    code: weather.weatherCode,
    temp: weather.temp,
    rainProb: weather.rainProb,
    personaId,
  });

  const tag =
    weather.conditionType === 'rain'
      ? '[Rain]'
      : weather.conditionType === 'thunder'
      ? '[Thunderstorm]'
      : weather.conditionType === 'snow'
      ? '[Snow]'
      : weather.temp >= 33
      ? '[Sunny]'
      : '[Cloudy]';

  return (
    `${tag} *Weather in ${weather.locationTitle}:*\n` +
    `• *Condition:* ${weather.conditionText}\n` +
    `• *Temperature:* ${weather.temp}°C (feels like ${weather.feelsLike}°C)\n` +
    `• *Range:* ${weather.minTemp}°C - ${weather.maxTemp}°C\n` +
    `• *Humidity:* ${weather.humidity}%\n` +
    `• *Precipitation Chance:* ${weather.rainProb}%\n` +
    `• *Wind Speed:* ${weather.windSpeed} km/h\n\n` +
    `_"${advice}"_`
  );
}

