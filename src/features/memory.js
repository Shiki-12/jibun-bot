import { InlineKeyboard } from 'grammy';
import { getFacts, deleteFact, clearFacts } from '../core/facts.js';

function getPersona(ctx) {
  return ctx?.persona ?? { strings: {} };
}

/**
 * Render teks daftar fakta dan tombol inline keyboard.
 */
export function renderMemoryView(userId, persona) {
  const p = persona ?? { strings: {} };
  const facts = getFacts(userId, 50);

  if (facts.length === 0) {
    return {
      text:
        p.strings?.memoryEmpty ??
        'I do not know anything about you yet. Stop trying to act mysterious. (¬_¬)',
      keyboard: null,
    };
  }

  const header = p.strings?.memoryHeader ?? '*Facts I remember about you:*';
  const lines = [header, ''];

  facts.forEach((f) => {
    lines.push(`• *#${f.id}* — ${f.fact}`);
  });

  lines.push('');
  lines.push('_Type `/delfact <id>` or use the buttons below to delete._');

  const keyboard = new InlineKeyboard();
  // Buat tombol hapus per fakta (maksimal 10 tombol pertama agar ringkas)
  const buttonsToDisplay = facts.slice(0, 8);
  buttonsToDisplay.forEach((f, idx) => {
    keyboard.text(`Delete #${f.id}`, `fact:del:${f.id}`);
    if (idx % 2 === 1) keyboard.row();
  });

  if (buttonsToDisplay.length % 2 !== 0) keyboard.row();
  keyboard.text('Delete All Facts', 'fact:clear_prompt');

  return { text: lines.join('\n'), keyboard };
}

export default {
  id: 'memory',

  commands: [
    {
      name: 'memory',
      description: 'View facts the bot remembers about you (/memory)',
      handler: async (ctx) => {
        const p = getPersona(ctx);
        const { text, keyboard } = renderMemoryView(ctx.from.id, p);
        await ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard ?? undefined,
        });
      },
    },
    {
      name: 'delfact',
      description: 'Delete a specific fact by ID (example: /delfact 5)',
      handler: async (ctx) => {
        const p = getPersona(ctx);
        const args = ctx.message.text.split(/\s+/).slice(1);
        const factId = Number(args[0]);

        if (!factId || isNaN(factId)) {
          await ctx.reply('Specify the fact ID you want to delete. Example: `/delfact 5`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const success = deleteFact(ctx.from.id, factId);
        if (!success) {
          await ctx.reply(`Fact #${factId} not found.`);
          return;
        }

        const template =
          p.strings?.factDeleted ?? 'Fact #{id} has been forgotten. Satisfied? (¬_¬)';
        await ctx.reply(template.replace('{id}', factId));
      },
    },
    {
      name: 'clearfacts',
      description: 'Delete all memory facts about yourself',
      handler: async (ctx) => {
        const keyboard = new InlineKeyboard()
          .text('Yes, Delete All', 'fact:clear_confirmed')
          .text('Cancel', 'fact:cancel');

        await ctx.reply(
          'Are you sure you want to delete *all* memory facts about yourself?',
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          },
        );
      },
    },
  ],

  callbacks: [
    {
      prefix: 'fact:',
      handler: async (ctx) => {
        const data = ctx.callbackQuery.data;
        const p = getPersona(ctx);

        if (data.startsWith('fact:del:')) {
          const factId = Number(data.slice('fact:del:'.length));
          if (factId) {
            deleteFact(ctx.from.id, factId);
            await ctx.answerCallbackQuery({ text: `Fact #${factId} deleted.` }).catch(() => {});
          }

          const { text, keyboard } = renderMemoryView(ctx.from.id, p);
          await ctx
            .editMessageText(text, {
              parse_mode: 'Markdown',
              reply_markup: keyboard ?? undefined,
            })
            .catch(() => {});
          return;
        }

        if (data === 'fact:clear_prompt') {
          await ctx.answerCallbackQuery().catch(() => {});
          const confirmKb = new InlineKeyboard()
            .text('Yes, Delete All', 'fact:clear_confirmed')
            .text('Cancel', 'fact:cancel');

          await ctx
            .editMessageText(
              'Are you sure you want to delete *all* facts about you that I remember?',
              {
                parse_mode: 'Markdown',
                reply_markup: confirmKb,
              },
            )
            .catch(() => {});
          return;
        }

        if (data === 'fact:clear_confirmed') {
          clearFacts(ctx.from.id);
          await ctx.answerCallbackQuery({ text: 'All facts deleted.' }).catch(() => {});

          const clearedText =
            p.strings?.factsCleared ??
            'All memory facts about you have been wiped clean. (¬_¬)';

          await ctx
            .editMessageText(clearedText, { parse_mode: 'Markdown' })
            .catch(() => {});
          return;
        }

        if (data === 'fact:cancel') {
          await ctx.answerCallbackQuery({ text: 'Cancelled.' }).catch(() => {});
          const { text, keyboard } = renderMemoryView(ctx.from.id, p);
          await ctx
            .editMessageText(text, {
              parse_mode: 'Markdown',
              reply_markup: keyboard ?? undefined,
            })
            .catch(() => {});
          return;
        }
      },
    },
  ],
};

