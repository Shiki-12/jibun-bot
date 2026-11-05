import { InputFile, InlineKeyboard } from 'grammy';
import {
  getUserExportData,
  deleteUserData,
  getPrivacyPolicyText,
} from '../core/export.js';
import { getSetting } from '../core/settings.js';
import { getPersonality } from '../personalities/index.js';

export default {
  id: 'export',

  commands: [
    {
      name: 'export',
      description: 'Download all personal data stored in the bot (JSON format)',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        try {
          if (typeof ctx.replyWithChatAction === 'function') {
            await ctx.replyWithChatAction('upload_document').catch(() => {});
          }

          const data = getUserExportData(userId);
          const jsonStr = JSON.stringify(data, null, 2);
          const fileBuffer = Buffer.from(jsonStr, 'utf-8');
          const fileName = `data_export_${userId}.json`;

          const caption =
            persona.strings?.exportDone ??
            'Here is a copy of all your personal data (JSON format).';

          await ctx.replyWithDocument(new InputFile(fileBuffer, fileName), {
            caption,
          });
        } catch (err) {
          console.error('Failed to export user data:', err);
          await ctx.reply('Failed to export data at this time.');
        }
      },
    },
    {
      name: 'deleteme',
      description: 'Permanently delete all personal data (two-step confirmation)',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        const warningTemplate =
          persona.strings?.deleteWarning ??
          '*Permanent Data Deletion Warning!*\n\n' +
            'This action will permanently delete ALL your personal data from the bot:\n' +
            '• Notes, to-do list, and reminders\n' +
            '• Expense records & mood journal\n' +
            '• Habits, AI memory facts, affinity points & game scores\n' +
            '• Profile and account preferences\n\n' +
            '_Deleted data CANNOT be recovered. Are you sure?_';

        const keyboard = new InlineKeyboard()
          .text('Yes, Delete All My Data', `delme:confirm:${userId}`)
          .text('Cancel', `delme:cancel:${userId}`);

        await ctx.reply(warningTemplate, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      },
    },
    {
      name: 'privacy',
      description: 'View privacy policy and data management guidelines',
      handler: async (ctx) => {
        const text = getPrivacyPolicyText();
        await ctx.reply(text, { parse_mode: 'Markdown' });
      },
    },
  ],

  callbacks: [
    {
      prefix: 'delme:confirm:',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        const targetId = Number(ctx.callbackQuery.data.slice('delme:confirm:'.length));

        if (!userId || userId !== targetId) {
          await ctx.answerCallbackQuery({
            text: 'This action can only be confirmed by the account owner.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        try {
          deleteUserData(userId);

          await ctx.answerCallbackQuery({ text: 'Data successfully deleted.' }).catch(() => {});

          const successMsg =
            persona.strings?.deleteSuccess ??
            '*All your personal data has been permanently deleted.*';

          await ctx.editMessageText(successMsg, { parse_mode: 'Markdown' }).catch(() => {});
        } catch (err) {
          console.error('Failed to delete user data:', err);
          await ctx.answerCallbackQuery({ text: 'An error occurred while deleting data.' }).catch(() => {});
        }
      },
    },
    {
      prefix: 'delme:cancel:',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        const targetId = Number(ctx.callbackQuery.data.slice('delme:cancel:'.length));

        if (!userId || userId !== targetId) {
          await ctx.answerCallbackQuery({
            text: 'This action can only be cancelled by the account owner.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        await ctx.answerCallbackQuery({ text: 'Cancelled.' }).catch(() => {});

        const cancelMsg =
          persona.strings?.deleteCancelled ??
          '*Data deletion cancelled.* Your data remains safe.';

        await ctx.editMessageText(cancelMsg, { parse_mode: 'Markdown' }).catch(() => {});
      },
    },
  ],
};

