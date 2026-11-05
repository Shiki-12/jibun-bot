import { getSetting, setSetting } from '../core/settings.js';
import {
  getPrayerData,
  formatPrayerSchedule,
  schedulePrayerRemindersForTarget,
  cancelPrayerRemindersForTarget,
} from '../core/prayer.js';

export default {
  id: 'prayer',

  commands: [
    {
      name: 'sholat',
      description: 'View 5 daily prayer times today (/sholat [city])',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const rawArg = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();
        const targetCity = rawArg || getSetting(ctx, 'city');

        if (!targetCity) {
          const noCityMsg =
            p.strings?.prayerNoCity ??
            'You have not set your home city yet!\n' +
              'Use `/sholat <city_name>` (example: `/sholat Bandung`)\n' +
              'or save your city with `/kota <city_name>`.';
          await ctx.reply(noCityMsg, { parse_mode: 'Markdown' });
          return;
        }

        try {
          await ctx.replyWithChatAction('typing');

          const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          const prayerData = await getPrayerData(targetCity);

          if (!prayerData) {
            const notFoundMsg =
              p.strings?.prayerCityNotFound?.replace('{city}', targetCity) ??
              `Prayer schedule for city "${targetCity}" not found. Check the spelling of the city name.`;
            await ctx.reply(notFoundMsg);
            return;
          }

          const report = formatPrayerSchedule({
            prayerData,
            cityName: targetCity,
            tz,
          });

          await ctx.reply(report, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('Error fetching prayer times:', err);
          const errMsg =
            p.strings?.prayerError ??
            'Failed to fetch prayer schedule data at this time. Try again later.';
          await ctx.reply(errMsg);
        }
      },
    },
    {
      name: 'adzan',
      description: 'Configure automated prayer reminders (/adzan on [minutes] or /adzan off)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const parts = ctx.message?.text?.trim().split(/\s+/) || [];
        const action = parts[1]?.toLowerCase();
        const leadArg = parts[2];

        const isPrivate = ctx.chat?.type === 'private' || !ctx.chat;
        const currentCity = getSetting(ctx, 'city');
        const isAdzanOn = Number(getSetting(ctx, 'adzan', 0)) === 1;
        const currentLead = Number(getSetting(ctx, 'adzan_lead', 10));

        if (!action) {
          if (isAdzanOn && currentCity) {
            const statusMsg =
              p.strings?.adzanStatusActive
                ?.replace('{city}', currentCity)
                ?.replace('{lead}', currentLead) ??
              `Prayer reminder status: *Active* (${currentLead} minutes before prayer time) for *${currentCity}*.\n\n` +
                `• Type \`/adzan off\` to disable.\n` +
                `• Type \`/adzan on [minutes]\` to adjust lead time (example: \`/adzan on 5\`).`;
            await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
          } else {
            const statusMsg =
              p.strings?.adzanStatusDisabled ??
              'Prayer reminder status: *Off*.\n\n' +
                'Type `/adzan on` to enable reminders 10 minutes before prayer time.';
            await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
          }
          return;
        }

        if (action === 'off') {
          setSetting(ctx, 'adzan', 0);
          cancelPrayerRemindersForTarget(ctx.chat.id, ctx.from?.id);
          const offMsg =
            p.strings?.adzanOff ??
            'Automated prayer reminders disabled.';
          await ctx.reply(offMsg);
          return;
        }

        if (action === 'on') {
          if (!currentCity) {
            const noCityMsg =
              p.strings?.adzanNoCity ??
              'City has not been set!\nPlease set your city first using `/kota <city_name>` (example: `/kota Surabaya`) before enabling prayer reminders.';
            await ctx.reply(noCityMsg, { parse_mode: 'Markdown' });
            return;
          }

          let leadMinutes = currentLead;
          if (leadArg && /^\d+$/.test(leadArg)) {
            leadMinutes = Math.min(60, Math.max(0, parseInt(leadArg, 10)));
          }

          setSetting(ctx, 'adzan', 1);
          setSetting(ctx, 'adzan_lead', leadMinutes);
          setSetting(ctx, 'adzan_last_date', null); // Trigger penjadwalan hari ini

          try {
            await schedulePrayerRemindersForTarget({
              chatId: ctx.chat.id,
              userId: ctx.from?.id,
              isPrivate,
            });
          } catch (err) {
            console.error('Error scheduling prayer reminders:', err);
          }

          const template =
            p.strings?.adzanOn ??
            'Prayer reminder enabled for *{city}* ({lead} minutes before prayer time).';
          const replyText = template
            .replace('{city}', currentCity)
            .replace('{lead}', leadMinutes);

          await ctx.reply(replyText, { parse_mode: 'Markdown' });
          return;
        }

        await ctx.reply(
          'Unrecognized command format.\nUse `/adzan on [minutes]` or `/adzan off`.',
          { parse_mode: 'Markdown' },
        );
      },
    },
  ],

  tags: [
    {
      name: 'PRAYER',
      promptHint:
        'Check prayer times for a city. Format: [PRAYER: city_name] (example: [PRAYER: Jakarta]). Emit this tag when user asks for prayer schedule or adzan time.',
      handle: async (ctx, args) => {
        const city = args?.[0]?.trim() || getSetting(ctx, 'city');
        if (!city) return;

        try {
          const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          const prayerData = await getPrayerData(city);
          if (prayerData) {
            const report = formatPrayerSchedule({
              prayerData,
              cityName: city,
              tz,
            });
            await ctx.reply(report, { parse_mode: 'Markdown' });
          }
        } catch (err) {
          console.error(`Failed to process tag [PRAYER: ${city}]:`, err.message);
        }
      },
    },
  ],
};

