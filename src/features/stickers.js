import {
  ALLOWED_MOODS,
  isValidMood,
  normalizeMood,
  deleteSticker,
  getStickersCountByMood,
  getTotalStickersCount,
  getRandomStickerByMood,
  setAdminAddStickerMode,
  getAdminAddStickerMode,
  clearAdminAddStickerMode,
} from '../core/stickers.js';
import { isAdmin } from '../core/guards.js';

export default {
  id: 'stickers',

  commands: [
    {
      name: 'addsticker',
      description: 'Add bot reaction sticker (admin only)',
      adminOnly: true,
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!isAdmin(userId)) {
          return;
        }

        const text = ctx.message?.text ?? '';
        const parts = text.split(/\s+/).slice(1);
        const moodArg = parts[0];

        if (!moodArg || !isValidMood(moodArg)) {
          const listMoods = ALLOWED_MOODS.join(', ');
          await ctx.reply(
            `Invalid format! Usage: /addsticker <mood>\n\nAvailable mood options:\n${listMoods}`,
          );
          return;
        }

        const mood = normalizeMood(moodArg);
        setAdminAddStickerMode(userId, mood);

        const msg =
          ctx.persona?.strings?.stickerModeActive?.replace('{mood}', mood) ??
          `Sticker addition mode active for mood "${mood}".\nSend one or more stickers now to this bot.\nType /cancelsticker when finished.`;
        await ctx.reply(msg);
      },
    },

    {
      name: 'cancelsticker',
      description: 'Cancel sticker addition mode',
      adminOnly: true,
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!isAdmin(userId)) {
          return;
        }

        const activeMode = getAdminAddStickerMode(userId);
        if (!activeMode) {
          await ctx.reply('You are not currently in sticker addition mode.');
          return;
        }
        clearAdminAddStickerMode(userId);
        const msg =
          ctx.persona?.strings?.stickerModeCancelled ??
          'Sticker addition mode cancelled.';
        await ctx.reply(msg);
      },
    },

    {
      name: 'stickers',
      description: 'View reaction sticker collection by mood',
      handler: async (ctx) => {
        const counts = getStickersCountByMood();
        const total = getTotalStickersCount();

        if (total === 0) {
          const emptyMsg =
            ctx.persona?.strings?.stickersEmpty ??
            'No stickers saved in this bot yet.';
          const adminHint = isAdmin(ctx.from?.id)
            ? '\n\nAdmin: Use /addsticker <mood> to start collecting stickers.'
            : '';
          await ctx.reply(emptyMsg + adminHint);
          return;
        }

        const lines = counts.map((item) => `- *${item.mood}*: ${item.count} stickers`);
        let response = `*Reaction Sticker Collection*\n\n${lines.join('\n')}\n\n*Total:* ${total} stickers`;
        if (isAdmin(ctx.from?.id)) {
          response +=
            '\n\n_Admin tips:_\n- `/addsticker <mood>` to add stickers\n- `/delsticker <id>` to delete stickers';
        }
        await ctx.reply(response, { parse_mode: 'Markdown' });
      },
    },

    {
      name: 'delsticker',
      description: 'Delete sticker by ID (admin only)',
      adminOnly: true,
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!isAdmin(userId)) {
          return;
        }

        const text = ctx.message?.text ?? '';
        const parts = text.split(/\s+/).slice(1);
        const id = Number(parts[0]);

        if (!parts[0] || isNaN(id)) {
          await ctx.reply('Invalid format! Usage: /delsticker <id>');
          return;
        }

        const deleted = deleteSticker(id);
        if (deleted) {
          await ctx.reply(`Sticker #${id} deleted.`);
        } else {
          await ctx.reply(`Sticker #${id} not found.`);
        }
      },
    },
  ],

  tags: [
    {
      name: 'STICKER',
      minArgs: 1,
      maxArgs: 1,
      maxArgLength: 50,
      promptHint:
        'Send reaction sticker matching mood (senang, kesal, malu, sedih, bingung, kaget, semangat, lelah). Format: [STICKER: mood]. Use only occasionally. NEVER use together with [GIF: ...] in a single reply.',
      handle: async (ctx, args) => {
        const mood = args[0];
        const sticker = getRandomStickerByMood(mood);
        if (sticker?.file_id) {
          try {
            await ctx.replyWithSticker(sticker.file_id);
          } catch (err) {
            console.error(`Failed to send sticker [${mood}]:`, err.message);
          }
        }
      },
    },
  ],
};

