import { getSetting, setSetting } from '../core/settings.js';
import {
  fetchCoordinates,
  getWeatherData,
  formatWeatherReport,
} from '../core/weather.js';

export default {
  id: 'weather',

  commands: [
    {
      name: 'kota',
      description: 'Set default home city (/kota <city_name>)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const rawArg = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();

        if (!rawArg) {
          const currentCity = getSetting(ctx, 'city');
          if (currentCity) {
            await ctx.reply(
              `Your current home city: *${currentCity}*.\nType \`/kota <new_city>\` to update.`,
              { parse_mode: 'Markdown' },
            );
          } else {
            await ctx.reply(
              'No home city configured yet.\nType `/kota <city_name>` (example: `/kota Bandung`).',
              { parse_mode: 'Markdown' },
            );
          }
          return;
        }

        try {
          await ctx.replyWithChatAction('typing');

          // Validasi apakah kota dapat ditemukan di geocoding
          const geo = await fetchCoordinates(rawArg);
          if (!geo) {
            const notFoundMsg =
              p.strings?.cityNotFound?.replace('{city}', rawArg) ??
              `City "${rawArg}" not found! Please check the spelling.`;
            await ctx.reply(notFoundMsg);
            return;
          }

          setSetting(ctx, 'city', geo.name);

          const template =
            p.strings?.citySaved ??
            'Home city successfully set to *{city}*. You can now use `/cuaca`.';
          const replyText = template.replace('{city}', geo.name);

          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('Error setting city:', err);
          await ctx.reply('An error occurred while verifying the city name. Please try again later.');
        }
      },
    },
    {
      name: 'cuaca',
      description: 'Check weather forecast for a city (/cuaca [city_name])',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const rawArg = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();
        const targetCity = rawArg || getSetting(ctx, 'city');

        if (!targetCity) {
          await ctx.reply(
            'You have not set your home city yet!\n' +
              'Use `/cuaca <city_name>` (example: `/cuaca Yogyakarta`)\n' +
              'or save your city with `/kota <city_name>`.',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        try {
          await ctx.replyWithChatAction('typing');

          const weather = await getWeatherData(targetCity);
          if (!weather) {
            const notFoundMsg =
              p.strings?.cityNotFound?.replace('{city}', targetCity) ??
              `City "${targetCity}" not found. Please verify the spelling.`;
            await ctx.reply(notFoundMsg);
            return;
          }

          const report = formatWeatherReport({
            weather,
            personaId: ctx.persona?.id || 'tsundere',
          });

          await ctx.reply(report, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('Error fetching weather:', err);
          const errMsg =
            p.strings?.weatherError ??
            'Failed to fetch weather data (connection timeout). Please try again shortly.';
          await ctx.reply(errMsg);
        }
      },
    },
  ],

  tags: [
    {
      name: 'WEATHER',
      promptHint:
        'Check current weather conditions for a specified city. Format: [WEATHER: city_name] (example: [WEATHER: Jakarta]). Emit this tag when user inquires about weather.',
      handle: async (ctx, args) => {
        const city = args?.[0]?.trim();
        if (!city) return;

        try {
          const weather = await getWeatherData(city);
          if (weather) {
            const report = formatWeatherReport({
              weather,
              personaId: ctx.persona?.id || 'tsundere',
            });
            await ctx.reply(report, { parse_mode: 'Markdown' });
          }
        } catch (err) {
          console.error(`Failed processing [WEATHER: ${city}] tag:`, err.message);
        }
      },
    },
  ],
};

