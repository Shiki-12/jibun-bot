import { getSetting } from '../core/settings.js';
import {
  addHabit,
  deleteHabit,
  getHabitById,
  logHabit,
  getUserHabitsWithStatus,
  getZonedDateAndMinutes,
} from '../core/habits.js';
import { InlineKeyboard } from 'grammy';

export default {
  id: 'habits',

  commands: [
    {
      name: 'habits',
      description: 'View your daily habits and streak list',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const userId = ctx.from?.id;
        if (!userId) return;

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const habits = getUserHabitsWithStatus(userId, tz);

        if (habits.length === 0) {
          const emptyMsg =
            p.strings?.habitEmpty ??
            'You do not have any daily habits yet.\n' +
              'Use `/habit add <name> [time]` to create a new habit.\n' +
              'Example: `/habit add Drink 2L water 08:00` or `/habit add Morning workout`.';
          await ctx.reply(emptyMsg, { parse_mode: 'Markdown' });
          return;
        }

        const { dateStr } = getZonedDateAndMinutes(new Date(), tz);
        const header = p.strings?.habitHeader ?? '*Your Daily Habits & Streaks:*';

        const lines = habits.map((h) => {
          let statusIcon = '[Pending]';
          if (h.todayStatus === 'done') statusIcon = '[Done]';
          if (h.todayStatus === 'skipped') statusIcon = '[Skipped]';

          const timeInfo = h.remindTime ? ` (${h.remindTime})` : '';
          return (
            `• *#${h.id}* ${h.name}${timeInfo}\n` +
            `  Status today: ${statusIcon}\n` +
            `  Streak: *${h.currentStreak} days* | Best: *${h.longestStreak} days*`
          );
        });

        // Buat tombol inline cepat untuk kebiasaan yang belum selesai hari ini
        const pendingHabits = habits.filter((h) => h.todayStatus === 'pending');
        const keyboard = new InlineKeyboard();

        pendingHabits.slice(0, 5).forEach((h) => {
          keyboard
            .text(`Done: #${h.id}`, `hbt:done:${h.id}:${dateStr}`)
            .text(`Skip: #${h.id}`, `hbt:skip:${h.id}:${dateStr}`)
            .row();
        });

        const footer =
          '\n_Type `/habit done <id>` or `/habit skip <id>` to log._\n' +
          '_Type `/habit del <id>` to delete a habit._';

        const replyOptions = { parse_mode: 'Markdown' };
        if (pendingHabits.length > 0) {
          replyOptions.reply_markup = keyboard;
        }

        await ctx.reply(`${header}\n\n${lines.join('\n\n')}\n${footer}`, replyOptions);
      },
    },
    {
      name: 'habit',
      description: 'Manage habits (/habit add <name> [time], /habit done <id>, /habit skip <id>, /habit del <id>)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const rawText = ctx.message?.text?.trim() || '';
        const parts = rawText.split(/\s+/).slice(1);
        const sub = parts[0]?.toLowerCase();
        const userId = ctx.from?.id;
        if (!userId) return;

        // Jika dipanggil /habit tanpa argumen -> tampilkan /habits
        if (!sub) {
          const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          const habits = getUserHabitsWithStatus(userId, tz);

          if (habits.length === 0) {
            const emptyMsg =
              p.strings?.habitEmpty ??
              'You do not have any daily habits yet.\n' +
                'Use `/habit add <name> [time]` to create a new habit.\n' +
                'Example: `/habit add Drink 2L water 08:00`.';
            await ctx.reply(emptyMsg, { parse_mode: 'Markdown' });
            return;
          }

          const { dateStr } = getZonedDateAndMinutes(new Date(), tz);
          const header = p.strings?.habitHeader ?? '*Your Daily Habits & Streaks:*';
          const lines = habits.map((h) => {
            let statusIcon = '[Pending]';
            if (h.todayStatus === 'done') statusIcon = '[Done]';
            if (h.todayStatus === 'skipped') statusIcon = '[Skipped]';

            const timeInfo = h.remindTime ? ` (${h.remindTime})` : '';
            return (
              `• *#${h.id}* ${h.name}${timeInfo}\n` +
              `  Status today: ${statusIcon}\n` +
              `  Streak: *${h.currentStreak} days* | Best: *${h.longestStreak} days*`
            );
          });

          await ctx.reply(`${header}\n\n${lines.join('\n\n')}`, {
            parse_mode: 'Markdown',
          });
          return;
        }

        // Subperintah: add
        if (sub === 'add') {
          const habitRaw = parts.slice(1).join(' ').trim();
          if (!habitRaw) {
            await ctx.reply(
              'Use format: `/habit add <habit_name> [HH:mm]`\nExample: `/habit add Read book 21:00`',
              { parse_mode: 'Markdown' },
            );
            return;
          }

          try {
            const habit = addHabit({ userId, name: habitRaw });
            const remindStr = habit.remindTime
              ? ` every day at *${habit.remindTime}*`
              : '';
            const template =
              p.strings?.habitAdded ??
              'New habit recorded: *"{name}"*{remind}. Stick with it!';
            const replyMsg = template
              .replace('{name}', habit.name)
              .replace('{remind}', remindStr);

            await ctx.reply(replyMsg, { parse_mode: 'Markdown' });
          } catch (err) {
            await ctx.reply(`[Error] ${err.message}`);
          }
          return;
        }

        // Subperintah: done
        if (sub === 'done') {
          const habitId = parseInt(parts[1], 10);
          if (isNaN(habitId)) {
            await ctx.reply('Use format: `/habit done <id>`');
            return;
          }

          try {
            const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
            const { dateStr } = getZonedDateAndMinutes(new Date(), tz);
            const res = logHabit({ habitId, userId, dateStr, status: 'done' });

            const template =
              p.strings?.habitDone ??
              'Good! Habit *"{name}"* completed today. Streak: *{streak} days*!';
            let replyMsg = template
              .replace('{name}', res.habit.name)
              .replace('{streak}', res.currentStreak);

            if (res.currentStreak > 1 && res.currentStreak % 3 === 0) {
              const streakTemplate =
                p.strings?.habitStreakCelebrate ??
                '\nImpressive! Consistency maintained for {streak} days in a row!';
              replyMsg += streakTemplate.replace('{streak}', res.currentStreak);
            }

            await ctx.reply(replyMsg, { parse_mode: 'Markdown' });
          } catch (err) {
            await ctx.reply(`[Error] ${err.message}`);
          }
          return;
        }

        // Subperintah: skip
        if (sub === 'skip') {
          const habitId = parseInt(parts[1], 10);
          if (isNaN(habitId)) {
            await ctx.reply('Use format: `/habit skip <id>`');
            return;
          }

          try {
            const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
            const { dateStr } = getZonedDateAndMinutes(new Date(), tz);
            const res = logHabit({ habitId, userId, dateStr, status: 'skipped' });

            const template =
              p.strings?.habitSkipped ??
              'Habit *"{name}"* skipped for today. Keep at it tomorrow!';
            const replyMsg = template.replace('{name}', res.habit.name);
            await ctx.reply(replyMsg, { parse_mode: 'Markdown' });
          } catch (err) {
            await ctx.reply(`[Error] ${err.message}`);
          }
          return;
        }

        // Subperintah: del
        if (sub === 'del' || sub === 'delete') {
          const habitId = parseInt(parts[1], 10);
          if (isNaN(habitId)) {
            await ctx.reply('Use format: `/habit del <id>`');
            return;
          }

          const ok = deleteHabit(habitId, userId);
          if (ok) {
            const template =
              p.strings?.habitDeleted ??
              'Habit #{id} deleted from your list.';
            await ctx.reply(template.replace('{id}', habitId));
          } else {
            const template =
              p.strings?.habitNotFound ??
              'Habit #{id} not found in your list.';
            await ctx.reply(template.replace('{id}', habitId));
          }
          return;
        }

        await ctx.reply(
          'Unrecognized command format.\nUsage:\n' +
            '• `/habit add <name> [time]`\n' +
            '• `/habit done <id>`\n' +
            '• `/habit skip <id>`\n' +
            '• `/habit del <id>`\n' +
            '• `/habits`',
          { parse_mode: 'Markdown' },
        );
      },
    },
    {
      name: 'delhabit',
      description: 'Delete habit by ID (/delhabit <id>)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const parts = ctx.message?.text?.trim().split(/\s+/) || [];
        const habitId = parseInt(parts[1], 10);
        const userId = ctx.from?.id;

        if (isNaN(habitId) || !userId) {
          await ctx.reply('Use format: `/delhabit <id>`');
          return;
        }

        const ok = deleteHabit(habitId, userId);
        if (ok) {
          const template =
            p.strings?.habitDeleted ??
            'Habit #{id} deleted from your list.';
          await ctx.reply(template.replace('{id}', habitId));
        } else {
          const template =
            p.strings?.habitNotFound ??
            'Habit #{id} not found in your list.';
          await ctx.reply(template.replace('{id}', habitId));
        }
      },
    },
  ],

  callbacks: [
    {
      prefix: 'hbt:',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const data = ctx.callbackQuery?.data || '';
        // Format: hbt:done:<id>:<date> atau hbt:skip:<id>:<date>
        const parts = data.split(':');
        const action = parts[1];
        const habitId = parseInt(parts[2], 10);
        const dateStr = parts[3];
        const userId = ctx.from?.id;

        if (!userId || isNaN(habitId) || !['done', 'skipped'].includes(action)) {
          await ctx.answerCallbackQuery({ text: 'Invalid button data.' });
          return;
        }

        try {
          const res = logHabit({ habitId, userId, dateStr, status: action });
          await ctx.answerCallbackQuery({
            text:
              action === 'done'
                ? `Great! Streak: ${res.currentStreak} days!`
                : 'Habit skipped.',
          });

          if (action === 'done') {
            const template =
              p.strings?.habitDone ??
              'Good! Habit *"{name}"* completed today. Streak: *{streak} days*!';
            let text = template
              .replace('{name}', res.habit.name)
              .replace('{streak}', res.currentStreak);

            if (res.currentStreak > 1 && res.currentStreak % 3 === 0) {
              const streakTemplate =
                p.strings?.habitStreakCelebrate ??
                '\nImpressive! Consistency for {streak} days in a row!';
              text += streakTemplate.replace('{streak}', res.currentStreak);
            }

            await ctx.editMessageText(text, { parse_mode: 'Markdown' });
          } else {
            const template =
              p.strings?.habitSkipped ??
              'Habit *"{name}"* skipped for today. Try again tomorrow!';
            const text = template.replace('{name}', res.habit.name);
            await ctx.editMessageText(text, { parse_mode: 'Markdown' });
          }
        } catch (err) {
          await ctx.answerCallbackQuery({ text: err.message });
        }
      },
    },
  ],

  tags: [
    {
      name: 'HABIT_ADD',
      promptHint:
        'Add a new daily habit. Format: [HABIT_ADD: habit_name | HH:mm] (time optional). Example: [HABIT_ADD: Take vitamins | 07:00], [HABIT_ADD: Meditate]. Use this tag when user wants to add a new habit or routine.',
      handle: async (ctx, args) => {
        const name = args?.[0]?.trim();
        const time = args?.[1]?.trim() || null;
        const userId = ctx.from?.id;
        if (!name || !userId) return;

        try {
          const habit = addHabit({ userId, name, remindTime: time });
          const p = ctx.persona ?? { strings: {} };
          const remindStr = habit.remindTime
            ? ` every day at *${habit.remindTime}*`
            : '';
          const template =
            p.strings?.habitAdded ??
            'New habit recorded: *"{name}"*{remind}. Stick with it!';
          const replyMsg = template
            .replace('{name}', habit.name)
            .replace('{remind}', remindStr);

          await ctx.reply(replyMsg, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('Failed to process tag [HABIT_ADD]:', err.message);
        }
      },
    },
    {
      name: 'HABIT_LOG',
      promptHint:
        'Log daily habit status (done or skip). Format: [HABIT_LOG: habit_id | done] or [HABIT_LOG: habit_id | skip]. Use when user reports completing or skipping a habit.',
      handle: async (ctx, args) => {
        const habitId = parseInt(args?.[0]?.trim(), 10);
        const action = args?.[1]?.trim().toLowerCase();
        const userId = ctx.from?.id;
        if (isNaN(habitId) || !userId || !['done', 'skip', 'skipped'].includes(action)) return;

        try {
          const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          const { dateStr } = getZonedDateAndMinutes(new Date(), tz);
          const status = action === 'skip' ? 'skipped' : 'done';
          const res = logHabit({ habitId, userId, dateStr, status });

          const p = ctx.persona ?? { strings: {} };
          if (status === 'done') {
            const template =
              p.strings?.habitDone ??
              'Good! Habit *"{name}"* completed today. Streak: *{streak} days*!';
            const text = template
              .replace('{name}', res.habit.name)
              .replace('{streak}', res.currentStreak);
            await ctx.reply(text, { parse_mode: 'Markdown' });
          } else {
            const template =
              p.strings?.habitSkipped ??
              'Habit *"{name}"* skipped for today.';
            const text = template.replace('{name}', res.habit.name);
            await ctx.reply(text, { parse_mode: 'Markdown' });
          }
        } catch (err) {
          console.error('Failed to process tag [HABIT_LOG]:', err.message);
        }
      },
    },
  ],
};

