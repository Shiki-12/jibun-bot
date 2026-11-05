import { InlineKeyboard } from 'grammy';
import { getDb } from '../core/db.js';
import { getSetting } from '../core/settings.js';
import {
  parseReminderInput,
  formatReminderTime,
} from '../core/time_parser.js';

const MAX_REMINDERS_PER_USER = 50;
const MAX_TEXT_LENGTH = 500;

function getPersona(ctx) {
  return ctx?.persona ?? { strings: {} };
}

/**
 * Buat baris database pengingat baru.
 */
export function insertReminder({
  chatId,
  userId,
  text,
  dueAt,
  tz,
  repeat = null,
}) {
  const db = getDb();

  // Cek batas pengingat aktif per user
  const countRow = db
    .prepare(
      `SELECT count(*) as c FROM reminders WHERE user_id = ? AND status = 'pending'`,
    )
    .get(userId);

  if (countRow?.c >= MAX_REMINDERS_PER_USER) {
    throw new Error(
      `Batas maksimal ${MAX_REMINDERS_PER_USER} pengingat aktif telah tercapai. Batalkan yang lama terlebih dahulu.`,
    );
  }

  const cleanText = text.slice(0, MAX_TEXT_LENGTH).trim();
  if (!cleanText) {
    throw new Error('Teks pengingat tidak boleh kosong.');
  }

  const info = db
    .prepare(
      `INSERT INTO reminders (chat_id, user_id, text, due_at, tz, repeat, status, created_at, snooze_count)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0)`,
    )
    .run(chatId, userId, cleanText, dueAt, tz, repeat, Date.now());

  return info.lastInsertRowid;
}

export default {
  id: 'reminders',

  commands: [
    {
      name: 'remind',
      description: 'Set a reminder (example: /remind 10m take medicine, /remind 17:30 go home)',
      handler: async (ctx) => {
        const p = getPersona(ctx);
        const args = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();

        if (!args) {
          await ctx.reply(
            'Usage example:\n' +
              '• `/remind 10m take medicine`\n' +
              '• `/remind 2h check oven`\n' +
              '• `/remind 17:30 head home`\n' +
              '• `/remind tomorrow 07:00 workout`\n' +
              '• `/remind every day 06:00 take vitamins`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');

        try {
          const { dueAt, repeat, text } = parseReminderInput(args, tz);
          const id = insertReminder({
            chatId: ctx.chat.id,
            userId: ctx.from.id,
            text,
            dueAt,
            tz,
            repeat,
          });

          const timeFormatted = formatReminderTime(dueAt, tz);
          let confirmText = `Reminder recorded for *${timeFormatted}*:\n"${text}"`;
          if (repeat) {
            confirmText += `\n_(Repeating: ${repeat})_`;
          }

          const template = p.strings?.reminderSet;
          if (template) {
            confirmText = template
              .replace('{time}', timeFormatted)
              .replace('{text}', text);
            if (repeat) confirmText += `\n_(Repeating: ${repeat})_`;
          }

          await ctx.reply(confirmText, { parse_mode: 'Markdown' });
        } catch (err) {
          await ctx.reply(`Failed to set reminder: ${err.message}`);
        }
      },
    },
    {
      name: 'reminders',
      description: 'View active reminders list',
      handler: async (ctx) => {
        const db = getDb();
        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');

        const rows = db
          .prepare(
            `SELECT * FROM reminders
             WHERE user_id = ? AND status = 'pending'
             ORDER BY due_at ASC`,
          )
          .all(ctx.from.id);

        if (rows.length === 0) {
          await ctx.reply('You have no active reminders at the moment.');
          return;
        }

        const lines = ['*Active Reminders List:*', ''];
        const keyboard = new InlineKeyboard();

        for (const rem of rows) {
          const timeStr = formatReminderTime(rem.due_at, tz);
          const repeatStr = rem.repeat ? ` [${rem.repeat}]` : '';
          lines.push(`• *#${rem.id}* (${timeStr}${repeatStr}):\n  ${rem.text}`);
          keyboard.text(`Cancel #${rem.id}`, `rem:cancel:${rem.id}`).row();
        }

        await ctx.reply(lines.join('\n'), {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      },
    },
    {
      name: 'cancel',
      description: 'Cancel reminder by ID (example: /cancel 12)',
      handler: async (ctx) => {
        const p = getPersona(ctx);
        const args = ctx.message.text.split(/\s+/).slice(1);
        const targetId = Number(args[0]);

        if (!targetId || isNaN(targetId)) {
          await ctx.reply('Specify the reminder ID to cancel. Example: `/cancel 3`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const db = getDb();
        const res = db
          .prepare(
            `UPDATE reminders SET status = 'cancelled'
             WHERE id = ? AND user_id = ? AND status = 'pending'`,
          )
          .run(targetId, ctx.from.id);

        if (res.changes === 0) {
          await ctx.reply(`Reminder #${targetId} not found or no longer active.`);
          return;
        }

        const msg =
          p.strings?.reminderCancelled?.replace('{id}', targetId) ??
          `Reminder #${targetId} cancelled.`;
        await ctx.reply(msg);
      },
    },
  ],

  tags: [
    {
      name: 'REMIND',
      minArgs: 2,
      maxArgs: 3,
      maxArgLength: 500,
      promptHint:
        'Buat pengingat waktu user. Format: [REMIND: <ISO 8601 dengan offset> | <tugas> | <ulang atau none>]. Contoh: [REMIND: 2026-11-05T07:00:00+07:00 | minum obat | none]. Hanya sertakan jika user secara jelas meminta diingatkan.',
      handle: async (ctx, args) => {
        const isoString = args[0];
        const taskText = args[1];
        const repeatVal = args[2] && args[2].toLowerCase() !== 'none' ? args[2] : null;

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const dueAt = Date.parse(isoString);

        if (isNaN(dueAt)) {
          console.warn(`Tag REMIND menerima ISO date tidak valid: ${isoString}`);
          return;
        }

        try {
          const id = insertReminder({
            chatId: ctx.chat.id,
            userId: ctx.from.id,
            text: taskText,
            dueAt,
            tz,
            repeat: repeatVal,
          });

          // Kirim konfirmasi deterministik (aturan umum no. 5)
          const timeFormatted = formatReminderTime(dueAt, tz);
          let confirm = `*Reminder Created (#${id})*\nTime: ${timeFormatted}\nTask: ${taskText}`;
          if (repeatVal) confirm += `\nRepeating: ${repeatVal}`;

          await ctx.reply(confirm, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('Failed to process REMIND tag:', err.message);
        }
      },
    },
  ],

  callbacks: [
    {
      prefix: 'rem:',
      handler: async (ctx) => {
        const data = ctx.callbackQuery.data; // rem:snz10:<id>, rem:snz60:<id>, rem:done:<id>, rem:cancel:<id>
        const parts = data.split(':');
        const action = parts[1];
        const remId = Number(parts[2]);

        const db = getDb();
        const now = Date.now();

        if (action === 'snz10' || action === 'snz60') {
          const addMs = action === 'snz10' ? 10 * 60_000 : 60 * 60_000;
          const label = action === 'snz10' ? '10 minutes' : '1 hour';

          const res = db
            .prepare(
              `UPDATE reminders
               SET status = 'pending', due_at = ?, snooze_count = snooze_count + 1
               WHERE id = ?`,
            )
            .run(now + addMs, remId);

          if (res.changes > 0) {
            await ctx.answerCallbackQuery({ text: `Snoozed for ${label}.` }).catch(() => {});
            await ctx.editMessageText(
              ctx.callbackQuery.message.text + `\n\n_(Snoozed for ${label})_`,
              { parse_mode: 'Markdown' },
            ).catch(() => {});
          } else {
            await ctx.answerCallbackQuery({ text: 'Reminder not found.' }).catch(() => {});
          }
          return;
        }

        if (action === 'done') {
          db.prepare(
            `UPDATE reminders SET status = 'sent', last_sent_at = ? WHERE id = ?`,
          ).run(now, remId);

          await ctx.answerCallbackQuery({ text: 'Reminder completed!' }).catch(() => {});
          await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n_(Completed)_',
            { parse_mode: 'Markdown' },
          ).catch(() => {});
          return;
        }

        if (action === 'cancel') {
          db.prepare(
            `UPDATE reminders SET status = 'cancelled' WHERE id = ?`,
          ).run(remId);

          await ctx.answerCallbackQuery({ text: `Reminder #${remId} cancelled.` }).catch(() => {});
          await ctx.deleteMessage().catch(() => {});
        }
      },
    },
  ],
};

