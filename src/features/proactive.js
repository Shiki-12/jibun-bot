import {
  parseQuietHours,
  getProactiveSettings,
  setProactiveEnabled,
  setQuietHours,
} from '../core/proactive.js';

export default {
  id: 'proactive',

  commands: [
    {
      name: 'proactive',
      description: 'Configure bot to reach out first when you are inactive (on/off)',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const text = ctx.message?.text ?? '';
        const parts = text.split(/\s+/).slice(1);
        const action = parts[0]?.toLowerCase();

        if (action === 'on') {
          setProactiveEnabled(userId, 1);
          const msg =
            ctx.persona?.strings?.proactiveEnabled ??
            'Proactive chat enabled! If you disappear for too long, I will check in on you. Not that I was lonely or anything! ( `_´ )';
          await ctx.reply(msg);
          return;
        }

        if (action === 'off') {
          setProactiveEnabled(userId, 0);
          const msg =
            ctx.persona?.strings?.proactiveDisabled ??
            'Proactive chat disabled. Fine then, I will not reach out first anymore! (¬_¬)';
          await ctx.reply(msg);
          return;
        }

        // Tampilkan status terkini
        const s = getProactiveSettings(userId);
        const statusStr = s.enabled ? '*Active*' : '*Disabled*';
        const unrepliedNote =
          s.unreplied_count >= 3
            ? '\n_Bot is currently paused from checking in because 3 messages are unanswered. Send any message to resume._'
            : '';

        const replyText =
          `*Proactive Chat Settings*\n\n` +
          `• Status: ${statusStr}\n` +
          `• Quiet Hours: \`${s.quiet_start}\` to \`${s.quiet_end}\`\n` +
          `• Minimum Inactivity: *${s.min_idle_hours} hours*\n` +
          `• Unanswered Messages: *${s.unreplied_count}/3*${unrepliedNote}\n\n` +
          `_Commands:_\n` +
          `• \`/proactive on\` — Enable proactive check-ins\n` +
          `• \`/proactive off\` — Disable proactive check-ins\n` +
          `• \`/quiet 22:00-07:00\` — Set quiet hours`;

        await ctx.reply(replyText, { parse_mode: 'Markdown' });
      },
    },

    {
      name: 'quiet',
      description: 'Set quiet hours range (example: /quiet 22:00-07:00)',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const text = ctx.message?.text ?? '';
        const rawArg = text.replace(/^\/quiet(@\w+)?/i, '').trim();

        if (!rawArg) {
          const s = getProactiveSettings(userId);
          await ctx.reply(
            `Current quiet hours: \`${s.quiet_start}\` to \`${s.quiet_end}\`.\n\nTo change, use format: \`/quiet 22:00-07:00\``,
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const parsed = parseQuietHours(rawArg);
        if (!parsed) {
          const invalidMsg =
            ctx.persona?.strings?.quietHoursInvalid ??
            'Invalid quiet hours format! Use format HH:mm-HH:mm, example: /quiet 22:00-07:00';
          await ctx.reply(invalidMsg);
          return;
        }

        setQuietHours(userId, parsed.quietStart, parsed.quietEnd);

        const successMsg =
          ctx.persona?.strings?.quietHoursSet
            ?.replace('{start}', parsed.quietStart)
            ?.replace('{end}', parsed.quietEnd) ??
          `Quiet hours set to *${parsed.quietStart}* to *${parsed.quietEnd}*. Bot will not send greetings during this period.`;

        await ctx.reply(successMsg, { parse_mode: 'Markdown' });
      },
    },
  ],
};

