import { InlineKeyboard } from 'grammy';
import { getDb } from '../core/db.js';
import { getSetting } from '../core/settings.js';
import { parseReminderInput, formatReminderTime } from '../core/time_parser.js';
import { insertReminder } from './reminders.js';

function getPersona(ctx) {
  return ctx?.persona ?? { strings: {} };
}

/**
 * Ambil daftar to-do aktif untuk user tertentu (diurutkan kronologis).
 */
export function getActiveUserTodos(userId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM todos WHERE user_id = ? AND done = 0 ORDER BY id ASC`,
    )
    .all(userId);
}

/**
 * Ambil to-do berdasarkan nomor urut tampilan user (1-indexed).
 */
export function getTodoByNumber(userId, number) {
  const list = getActiveUserTodos(userId);
  const idx = number - 1;
  if (idx < 0 || idx >= list.length) return null;
  return { todo: list[idx], index: number, total: list.length };
}

/**
 * Tambah item to-do baru.
 */
export function insertTodo({ userId, text, dueAt = null }) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO todos (user_id, text, done, due_at, created_at)
       VALUES (?, ?, 0, ?, ?)`,
    )
    .run(userId, text.trim(), dueAt, Date.now());
  return info.lastInsertRowid;
}

/**
 * Tandai to-do selesai.
 */
export function markTodoDone(todoId) {
  const db = getDb();
  return db
    .prepare(`UPDATE todos SET done = 1, done_at = ? WHERE id = ?`)
    .run(Date.now(), todoId);
}

/**
 * Hapus to-do.
 */
export function deleteTodo(todoId) {
  const db = getDb();
  return db.prepare(`DELETE FROM todos WHERE id = ?`).run(todoId);
}

/**
 * Render tampilan daftar to-do dengan nomor urut user dan inline keyboard.
 */
export function renderTodoList(todos, tz = 'Asia/Jakarta') {
  if (todos.length === 0) {
    return {
      text: 'Your to-do list is empty. Nothing to do right now. (¬_¬)',
      keyboard: null,
    };
  }

  const lines = ['*To-Do List:*', ''];
  const keyboard = new InlineKeyboard();

  todos.forEach((todo, idx) => {
    const num = idx + 1;
    const dueInfo = todo.due_at
      ? ` _(@ ${formatReminderTime(todo.due_at, tz)})_`
      : '';
    lines.push(`*${num}.* ${todo.text}${dueInfo}`);
    keyboard
      .text(`#${num} Done`, `todo:done:${todo.id}`)
      .text(`Delete`, `todo:del:${todo.id}`)
      .row();
  });

  return { text: lines.join('\n'), keyboard };
}

export default {
  id: 'todo',

  commands: [
    {
      name: 'todo',
      description: 'Add to-do (/todo buy groceries @tomorrow) or view list (/todo)',
      handler: async (ctx) => {
        const rawArgs = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const p = getPersona(ctx);

        // Jika dipanggil tanpa argumen, tampilkan daftar to-do
        if (!rawArgs) {
          const todos = getActiveUserTodos(ctx.from.id);
          const { text, keyboard } = renderTodoList(todos, tz);
          await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard ?? undefined,
          });
          return;
        }

        // Cek apakah ada penanda waktu jatuh tempo (@waktu)
        let todoText = rawArgs;
        let dueAt = null;

        const atIndex = rawArgs.lastIndexOf('@');
        if (atIndex !== -1) {
          const timePart = rawArgs.slice(atIndex + 1).trim();
          const candidateText = rawArgs.slice(0, atIndex).trim();

          if (candidateText && timePart) {
            try {
              const parsedTime = parseReminderInput(timePart, tz);
              dueAt = parsedTime.dueAt;
              todoText = candidateText;

              // Otomatis buat pengingat lewat F-10
              insertReminder({
                chatId: ctx.chat.id,
                userId: ctx.from.id,
                text: `To-do: ${todoText}`,
                dueAt,
                tz,
                repeat: parsedTime.repeat,
              });
            } catch (err) {
              // Jika parse @ gagal, anggap seluruh teks sebagai teks to-do biasa
              console.warn('Failed parsing @time for to-do:', err.message);
            }
          }
        }

        insertTodo({ userId: ctx.from.id, text: todoText, dueAt });

        let confirmMsg = `To-do recorded: *"${todoText}"*`;
        if (dueAt) {
          confirmMsg += `\n_(Reminder set for ${formatReminderTime(dueAt, tz)})_`;
        }

        const template = p.strings?.todoAdded;
        if (template) {
          confirmMsg = template.replace('{text}', todoText);
          if (dueAt) {
            confirmMsg += `\n_(Reminder: ${formatReminderTime(dueAt, tz)})_`;
          }
        }

        await ctx.reply(confirmMsg, { parse_mode: 'Markdown' });
      },
    },
    {
      name: 'list',
      description: 'Show active to-do list with interactive action buttons',
      handler: async (ctx) => {
        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const todos = getActiveUserTodos(ctx.from.id);
        const { text, keyboard } = renderTodoList(todos, tz);

        await ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard ?? undefined,
        });
      },
    },
    {
      name: 'done',
      description: 'Mark to-do as completed by number (example: /done 1)',
      handler: async (ctx) => {
        const p = getPersona(ctx);
        const args = ctx.message.text.split(/\s+/).slice(1);
        const num = Number(args[0]);

        if (!num || isNaN(num)) {
          await ctx.reply('Specify the item number of the completed to-do. Example: `/done 1`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const match = getTodoByNumber(ctx.from.id, num);
        if (!match) {
          await ctx.reply(
            p.strings?.todoNotFound ??
              `To-do item #${num} not found. Check active items in /list.`,
          );
          return;
        }

        markTodoDone(match.todo.id);

        const doneMsg =
          p.strings?.todoDone?.replace('{text}', match.todo.text) ??
          `To-do *"${match.todo.text}"* completed.`;
        await ctx.reply(doneMsg, { parse_mode: 'Markdown' });
      },
    },
    {
      name: 'deltodo',
      description: 'Delete to-do by number (example: /deltodo 2)',
      handler: async (ctx) => {
        const p = getPersona(ctx);
        const args = ctx.message.text.split(/\s+/).slice(1);
        const num = Number(args[0]);

        if (!num || isNaN(num)) {
          await ctx.reply('Specify the item number of the to-do to delete. Example: `/deltodo 1`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const match = getTodoByNumber(ctx.from.id, num);
        if (!match) {
          await ctx.reply(`To-do item #${num} not found.`);
          return;
        }

        deleteTodo(match.todo.id);

        const delMsg =
          p.strings?.todoDeleted?.replace('{num}', num) ??
          `To-do #${num} *"${match.todo.text}"* successfully deleted.`;
        await ctx.reply(delMsg, { parse_mode: 'Markdown' });
      },
    },
  ],

  tags: [
    {
      name: 'TODO_ADD',
      minArgs: 1,
      maxArgs: 1,
      maxArgLength: 300,
      promptHint:
        'Add item to to-do list. Format: [TODO_ADD: task text @optional_time]. Example: [TODO_ADD: buy groceries @tomorrow 07:00]',
      handle: async (ctx, [rawText]) => {
        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        let todoText = rawText;
        let dueAt = null;

        const atIdx = rawText.lastIndexOf('@');
        if (atIdx !== -1) {
          const timePart = rawText.slice(atIdx + 1).trim();
          const cand = rawText.slice(0, atIdx).trim();
          if (cand && timePart) {
            try {
              const parsed = parseReminderInput(timePart, tz);
              dueAt = parsed.dueAt;
              todoText = cand;
              insertReminder({
                chatId: ctx.chat.id,
                userId: ctx.from.id,
                text: `To-do: ${todoText}`,
                dueAt,
                tz,
                repeat: parsed.repeat,
              });
            } catch {}
          }
        }

        insertTodo({ userId: ctx.from.id, text: todoText, dueAt });
        const timeStr = dueAt ? ` (@ ${formatReminderTime(dueAt, tz)})` : '';
        await ctx.reply(`*To-Do Added:*\n"${todoText}"${timeStr}`, {
          parse_mode: 'Markdown',
        });
      },
    },
    {
      name: 'TODO_DONE',
      minArgs: 1,
      maxArgs: 1,
      maxArgLength: 100,
      promptHint:
        'Mark to-do completed by number or keyword. Format: [TODO_DONE: number_or_keyword]. Example: [TODO_DONE: 1] or [TODO_DONE: buy groceries]',
      handle: async (ctx, [query]) => {
        const p = getPersona(ctx);
        const cleanQuery = query.trim();
        const activeTodos = getActiveUserTodos(ctx.from.id);

        if (activeTodos.length === 0) {
          await ctx.reply(
            p.strings?.todoEmpty ?? 'Your to-do list is already empty.',
          );
          return;
        }

        // Cek jika query adalah angka nomor urut
        const num = Number(cleanQuery);
        if (!isNaN(num) && num >= 1 && num <= activeTodos.length) {
          const item = activeTodos[num - 1];
          markTodoDone(item.id);
          await ctx.reply(`To-do *"${item.text}"* completed!`, {
            parse_mode: 'Markdown',
          });
          return;
        }

        // Pencarian fuzzy kata kunci
        const matches = activeTodos.filter((t) =>
          t.text.toLowerCase().includes(cleanQuery.toLowerCase()),
        );

        if (matches.length === 1) {
          const item = matches[0];
          markTodoDone(item.id);
          await ctx.reply(`To-do *"${item.text}"* completed!`, {
            parse_mode: 'Markdown',
          });
        } else if (matches.length > 1) {
          const listStr = matches
            .map((m) => {
              const originalNum = activeTodos.findIndex((x) => x.id === m.id) + 1;
              return `• /done ${originalNum} — "${m.text}"`;
            })
            .join('\n');
          await ctx.reply(
            `Multiple to-do items matched "${cleanQuery}", choose one:\n${listStr}`,
          );
        } else {
          await ctx.reply(
            `No to-do items matched keyword "${cleanQuery}".`,
          );
        }
      },
    },
  ],

  callbacks: [
    {
      prefix: 'todo:',
      handler: async (ctx) => {
        const data = ctx.callbackQuery.data; // todo:done:<id> or todo:del:<id>
        const parts = data.split(':');
        const action = parts[1];
        const todoId = Number(parts[2]);

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');

        if (action === 'done') {
          markTodoDone(todoId);
          await ctx.answerCallbackQuery({ text: 'To-do completed!' }).catch(() => {});
        } else if (action === 'del') {
          deleteTodo(todoId);
          await ctx.answerCallbackQuery({ text: 'To-do deleted.' }).catch(() => {});
        }

        // Perbarui tampilan daftar setelah perubahan
        const todos = getActiveUserTodos(ctx.from.id);
        const { text, keyboard } = renderTodoList(todos, tz);

        await ctx
          .editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard ?? undefined,
          })
          .catch(() => {});
      },
    },
  ],
};

