import { getSetting } from '../core/settings.js';
import {
  parseTimerDuration,
  formatDuration,
  createTimer,
  getActiveTimers,
  cancelTimer,
  getActivePomodoro,
  startPomodoro,
  stopPomodoro,
} from '../core/timer.js';

export default {
  id: 'timer',

  commands: [
    {
      name: 'timer',
      description: 'Set countdown timer (/timer <duration> [name] or /timer to list)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const rawText = ctx.message?.text?.trim() || '';
        const parts = rawText.split(/\s+/).slice(1);

        // Jika dipanggil tanpa argumen -> tampilkan daftar timer aktif
        if (parts.length === 0) {
          const active = getActiveTimers(ctx.chat.id);
          if (active.length === 0) {
            const emptyMsg =
              p.strings?.timerListEmpty ??
              'No active timers running in this chat.';
            await ctx.reply(emptyMsg);
            return;
          }

          const header =
            p.strings?.timerListHeader ?? '*Active Timers List:*';
          const lines = active.map(
            (t) =>
              `• *#${t.id}*: ${t.label} (~${formatDuration(t.remainingMs)} remaining)`,
          );
          const footer = '\nType `/canceltimer <id>` to cancel a timer.';
          await ctx.reply(`${header}\n\n${lines.join('\n')}${footer}`, {
            parse_mode: 'Markdown',
          });
          return;
        }

        // Subperintah pembatalan: /timer cancel <id>
        if (parts[0].toLowerCase() === 'cancel' && parts[1]) {
          const timerId = parseInt(parts[1], 10);
          const ok = cancelTimer(timerId, ctx.chat.id);
          if (ok) {
            const cancelMsg =
              p.strings?.timerCancelled?.replace('{id}', timerId) ??
              `Timer #${timerId} successfully cancelled.`;
            await ctx.reply(cancelMsg);
          } else {
            const notFoundMsg =
              p.strings?.timerNotFound?.replace('{id}', timerId) ??
              `Timer #${timerId} not found or already finished.`;
            await ctx.reply(notFoundMsg);
          }
          return;
        }

        const durationArg = parts[0];
        const labelArg = parts.slice(1).join(' ').trim() || 'Time is up!';

        try {
          const durationMs = parseTimerDuration(durationArg);
          const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          const timer = createTimer({
            chatId: ctx.chat.id,
            userId: ctx.from?.id,
            durationMs,
            label: labelArg,
            tz,
          });

          const durStr = formatDuration(durationMs);
          const template =
            p.strings?.timerSet ??
            '*Timer Started!*\n• Duration: *{duration}*\n• Label: *{label}*\n• Finishes at: *{time}* ({tz})';
          const replyText = template
            .replace('{duration}', durStr)
            .replace('{label}', timer.label)
            .replace('{time}', timer.timeStr)
            .replace('{tz}', tz);

          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          await ctx.reply(`[Error] ${err.message}`);
        }
      },
    },
    {
      name: 'canceltimer',
      description: 'Cancel active timer (/canceltimer <id>)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const parts = ctx.message?.text?.trim().split(/\s+/) || [];
        const timerId = parseInt(parts[1], 10);

        if (isNaN(timerId)) {
          await ctx.reply('Use format: `/canceltimer <id>`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const ok = cancelTimer(timerId, ctx.chat.id);
        if (ok) {
          const cancelMsg =
            p.strings?.timerCancelled?.replace('{id}', timerId) ??
            `Timer #${timerId} successfully cancelled.`;
          await ctx.reply(cancelMsg);
        } else {
          const notFoundMsg =
            p.strings?.timerNotFound?.replace('{id}', timerId) ??
            `Timer #${timerId} not found or already finished.`;
          await ctx.reply(notFoundMsg);
        }
      },
    },
    {
      name: 'pomodoro',
      description: 'Start or check Pomodoro session (/pomodoro [work] [break] [cycles], /pomodoro status, /pomodoro stop)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const rawText = ctx.message?.text?.trim() || '';
        const parts = rawText.split(/\s+/).slice(1);
        const sub = parts[0]?.toLowerCase();

        // 1. Cek status sesi berjalan
        if (sub === 'status') {
          const pom = getActivePomodoro(ctx.chat.id);
          if (!pom) {
            const noActiveMsg =
              p.strings?.pomodoroNoActive ??
              'No Pomodoro session currently running in this chat.';
            await ctx.reply(noActiveMsg);
            return;
          }

          const phaseName = pom.phase === 'work' ? 'Focus' : 'Break';
          const remStr = formatDuration(pom.remainingMs);
          const statusMsg =
            p.strings?.pomodoroStatus
              ?.replace('{cycle}', pom.cycle)
              ?.replace('{totalCycles}', pom.totalCycles)
              ?.replace('{phase}', phaseName)
              ?.replace('{remaining}', remStr) ??
            `*Pomodoro Status:*\n` +
              `• Phase: *${phaseName}*\n` +
              `• Cycle: *${pom.cycle}/${pom.totalCycles}*\n` +
              `• Remaining time: *${remStr}*\n\n` +
              `Type \`/stop\` to cancel the session.`;

          await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
          return;
        }

        // 2. Berhenti lewat sub-arg: /pomodoro stop
        if (sub === 'stop') {
          const ok = stopPomodoro(ctx.chat.id);
          if (ok) {
            const stopMsg =
              p.strings?.pomodoroStopped ??
              'Pomodoro session has been stopped.';
            await ctx.reply(stopMsg);
          } else {
            const noActiveMsg =
              p.strings?.pomodoroNoActive ??
              'No Pomodoro session currently running in this chat.';
            await ctx.reply(noActiveMsg);
          }
          return;
        }

        // 3. Mulai sesi baru: /pomodoro [work] [break] [cycles]
        let workMin = 25;
        let breakMin = 5;
        let cycles = 4;

        if (parts[0] && /^\d+$/.test(parts[0])) {
          workMin = parseInt(parts[0], 10);
        }
        if (parts[1] && /^\d+$/.test(parts[1])) {
          breakMin = parseInt(parts[1], 10);
        }
        if (parts[2] && /^\d+$/.test(parts[2])) {
          cycles = parseInt(parts[2], 10);
        }

        try {
          const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          const pom = startPomodoro({
            chatId: ctx.chat.id,
            userId: ctx.from?.id,
            workMin,
            breakMin,
            cycles,
            tz,
          });

          const template =
            p.strings?.pomodoroStarted ??
            `*Pomodoro Session Started!*\n` +
              `• Cycle 1/{cycles}: Focus for *{work} minutes* (finishes: {time})\n` +
              `• Break duration: *{break} minutes*\n\n` +
              `Stay focused and finish your tasks! Type \`/stop\` anytime to stop.`;

          const replyText = template
            .replace('{work}', pom.workMin)
            .replace('{break}', pom.breakMin)
            .replace('{cycles}', pom.totalCycles)
            .replace('{time}', pom.timeStr);

          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          await ctx.reply(`[Error] ${err.message}`);
        }
      },
    },
    {
      name: 'stop',
      description: 'Stop active Pomodoro session',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const ok = stopPomodoro(ctx.chat.id);
        if (ok) {
          const stopMsg =
            p.strings?.pomodoroStopped ??
            'Pomodoro session has been stopped.';
          await ctx.reply(stopMsg);
        } else {
          const noActiveMsg =
            p.strings?.pomodoroNoActive ??
            'No Pomodoro session currently running in this chat.';
          await ctx.reply(noActiveMsg);
        }
      },
    },
  ],

  tags: [
    {
      name: 'TIMER',
      promptHint:
        'Start countdown timer. Format: [TIMER: duration | label] (example: [TIMER: 15m | boil eggs], [TIMER: 30s | hold breath], [TIMER: 1h 30m | lunch break]). Emit this tag when user asks to set a countdown timer.',
      handle: async (ctx, args) => {
        const rawDuration = args?.[0]?.trim();
        const label = args?.[1]?.trim() || 'Time is up!';
        if (!rawDuration) return;

        try {
          const durationMs = parseTimerDuration(rawDuration);
          const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          const timer = createTimer({
            chatId: ctx.chat.id,
            userId: ctx.from?.id,
            durationMs,
            label,
            tz,
          });

          const p = ctx.persona ?? { strings: {} };
          const durStr = formatDuration(durationMs);
          const template =
            p.strings?.timerSet ??
            '*Timer Started!*\n• Duration: *{duration}*\n• Label: *{label}*\n• Finishes at: *{time}* ({tz})';
          const replyText = template
            .replace('{duration}', durStr)
            .replace('{label}', timer.label)
            .replace('{time}', timer.timeStr)
            .replace('{tz}', tz);

          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error(`Failed to process tag [TIMER: ${rawDuration}]:`, err.message);
        }
      },
    },
    {
      name: 'POMODORO',
      promptHint:
        'Start or stop Pomodoro session. Format: [POMODORO: start | work | break | cycles] (example: [POMODORO: start | 25 | 5 | 4]) or [POMODORO: stop]. Emit this tag when user asks to start or stop a focus/pomodoro session.',
      handle: async (ctx, args) => {
        const action = args?.[0]?.trim().toLowerCase();
        const p = ctx.persona ?? { strings: {} };

        if (action === 'stop') {
          const ok = stopPomodoro(ctx.chat.id);
          if (ok) {
            const stopMsg =
              p.strings?.pomodoroStopped ??
              'Pomodoro session has been stopped.';
            await ctx.reply(stopMsg);
          }
          return;
        }

        if (action === 'start') {
          const workMin = parseInt(args?.[1]?.trim(), 10) || 25;
          const breakMin = parseInt(args?.[2]?.trim(), 10) || 5;
          const cycles = parseInt(args?.[3]?.trim(), 10) || 4;

          try {
            const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
            const pom = startPomodoro({
              chatId: ctx.chat.id,
              userId: ctx.from?.id,
              workMin,
              breakMin,
              cycles,
              tz,
            });

            const template =
              p.strings?.pomodoroStarted ??
              `*Pomodoro Session Started!*\n` +
                `• Cycle 1/{cycles}: Focus for *{work} minutes* (finishes: {time})\n` +
                `• Break duration: *{break} minutes*\n\n` +
                `Stay focused and finish your tasks! Type \`/stop\` anytime to stop.`;

            const replyText = template
              .replace('{work}', pom.workMin)
              .replace('{break}', pom.breakMin)
              .replace('{cycles}', pom.totalCycles)
              .replace('{time}', pom.timeStr);

            await ctx.reply(replyText, { parse_mode: 'Markdown' });
          } catch (err) {
            console.error('Failed to process tag [POMODORO: start]:', err.message);
          }
        }
      },
    },
  ],
};

