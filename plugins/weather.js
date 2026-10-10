/**
 * Weather via OpenWeatherMap. Key is read from OPENWEATHER_API_KEY — never
 * hardcoded. When the key is missing the plugin replies with a clear message
 * instead of crashing.
 */
export default {
  name: 'weather',
  description: 'Current weather or 5-day forecast for a city',
  category: 'Tools',
  command: 'weather',
  async execute(ctx) {
    try {
      const key = ctx.config.openWeatherApiKey;
      if (!key) {
        await ctx.reply(
          '🌦️ Weather is disabled. Set `OPENWEATHER_API_KEY` in your .env to enable it.',
        );
        return;
      }
      if (!ctx.args[0]) {
        await ctx.reply(
          `Usage:\n• ${ctx.prefix}weather <city>\n• ${ctx.prefix}weather <city> daily`,
        );
        return;
      }

      const last = ctx.args[ctx.args.length - 1].toLowerCase();
      const forecast = ['daily', 'weekly', 'forecast'].includes(last);
      const city = (forecast ? ctx.args.slice(0, -1) : ctx.args).join(' ').trim();
      if (!city || city.length > 80) {
        await ctx.reply('❌ Please provide a valid city name.');
        return;
      }

      const cityQ = encodeURIComponent(city);
      const timeout = ctx.config.httpTimeoutMs;
      if (!forecast) {
        const url =
          `https://api.openweathermap.org/data/2.5/weather?q=${cityQ}` +
          `&appid=${key}&units=metric`;
        const data = await fetchJson(url, timeout);
        const temp = Math.round(data.main.temp);
        const feels = Math.round(data.main.feels_like);
        const desc = capitalize(data.weather[0].description);
        const icon = weatherEmoji(data.weather[0].id);
        await ctx.reply(
          `🌦️ *Weather*\n` +
            `🌍 ${data.name}, ${data.sys.country}\n` +
            `${icon} ${desc}\n` +
            `🌡️ ${temp}°C (feels ${feels}°C)\n` +
            `💧 Humidity ${data.main.humidity}%\n` +
            `🌬️ Wind ${data.wind.speed} m/s\n` +
            `_Tip: ${ctx.prefix}weather ${city} daily_`,
        );
      } else {
        const url =
          `https://api.openweathermap.org/data/2.5/forecast?q=${cityQ}` +
          `&appid=${key}&units=metric`;
        const data = await fetchJson(url, timeout);
        const days = data.list.filter((r) => r.dt_txt.includes('12:00:00'));
        let report =
          `📅 *5-day forecast*\n🌍 ${data.city.name}, ${data.city.country}\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
        for (const day of days) {
          const date = new Date(day.dt * 1000).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          report +=
            `${weatherEmoji(day.weather[0].id)} *${date}:* ` +
            `${Math.round(day.main.temp)}°C (${day.weather[0].main})\n`;
        }
        await ctx.reply(report);
      }
    } catch (err) {
      if (err.status === 404) {
        await ctx.reply('❌ City not found. Check the spelling.');
        return;
      }
      if (err.status === 401) {
        await ctx.reply('❌ OpenWeather API key looks invalid.');
        return;
      }
      ctx.logger.error({ err: err.message }, 'weather error');
      await ctx.reply('❌ Could not fetch weather right now.');
    }
  },
};

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function capitalize(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

function weatherEmoji(id) {
  if (id >= 200 && id < 300) return '⚡';
  if (id >= 300 && id < 500) return '🌧️';
  if (id >= 500 && id < 600) return '☔';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫️';
  if (id === 800) return '☀️';
  if (id > 800) return '☁️';
  return '🌡️';
}
