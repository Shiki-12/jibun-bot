import {
  isGroupAdmin,
  getGroupSettings,
  setGroupSetting,
  getGroupMessages,
  summarizeGroupMessages,
} from '../core/groups.js';
import { getSetting } from '../core/settings.js';
import { getPersonality } from '../personalities/index.js';

export default {
  id: 'groups',

  init: async ({ bot }) => {
    if (!bot || typeof bot.on !== 'function') return;

    // Handler event saat anggota baru bergabung ke grup
    bot.on('message:new_chat_members', async (ctx) => {
      if (!ctx.chat || ctx.chat.type === 'private') return;

      const newMembers = ctx.message.new_chat_members || [];
      const settings = getGroupSettings(ctx.chat.id);
      const personaId = getSetting(ctx, 'persona') || 'tsundere';
      const persona = getPersonality(personaId, ctx);

      for (const member of newMembers) {
        // Jika yang bergabung adalah bot sendiri
        if (member.id === ctx.me?.id) {
          const introMsg =
            `${persona.greeting}\n\n` +
            '*Group Usage Guide:*\n' +
            `• Bot only responds when mentioned (@${ctx.me?.username}) or replied to (unless /chatty is enabled).\n` +
            '• Bot keeps a buffer of the last 200 messages for /rangkum_grup.\n' +
            '• Ensure *Group Privacy* is turned off in @BotFather or make the bot an admin so it can read messages.';
          await ctx.reply(introMsg, { parse_mode: 'Markdown' }).catch(() => {});
          continue;
        }

        // Jika anggota baru adalah pengguna manusia & fitur welcome aktif
        if (settings.welcome_enabled) {
          const groupTitle = ctx.chat.title || 'group';
          const name = member.first_name || 'Friend';
          const template =
            persona.strings?.groupWelcome ??
            'Welcome to {group}, {name}!';
          const welcomeText = template
            .replace('{name}', name)
            .replace('{group}', groupTitle);

          await ctx.reply(welcomeText).catch(() => {});
        }
      }
    });
  },

  commands: [
    {
      name: 'rangkum_grup',
      description: 'Summarize recent group conversation (/rangkum_grup [count])',
      handler: async (ctx) => {
        if (!ctx.chat || ctx.chat.type === 'private') {
          const personaId = getSetting(ctx, 'persona') || 'tsundere';
          const persona = getPersonality(personaId, ctx);
          const notGroupMsg =
            persona.strings?.notGroupChat ??
            'This command can only be used in a group chat.';
          await ctx.reply(notGroupMsg);
          return;
        }

        const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
        const count = args[0] ? Number(args[0]) : 30;

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        const messages = getGroupMessages(ctx.chat.id, count);

        if (messages.length < 3) {
          await ctx.reply(
            'Not enough message history in this group to summarize (at least 3 messages needed).\n' +
              'Group messages will be recorded while the bot is active here (up to 200 most recent).',
          );
          return;
        }

        try {
          if (typeof ctx.replyWithChatAction === 'function') {
            await ctx.replyWithChatAction('typing').catch(() => {});
          }

          const summarize = ctx.summarizeGroupMessagesFn || summarizeGroupMessages;
          const res = await summarize({ messages });

          const introTemplate =
            persona.strings?.groupSummaryIntro ??
            'Summary of the last {count} messages in this group:';
          const intro = introTemplate.replace('{count}', res.messageCount);

          await ctx.reply(`${intro}\n\n${res.summaryText}`);
        } catch (err) {
          console.error('Failed to summarize group:', err);
          await ctx.reply(
            persona.errorMessage || 'An error occurred while summarizing group messages.',
          );
        }
      },
    },
    {
      name: 'chatty',
      description: 'Enable/disable spontaneous bot replies in group (/chatty [on|off])',
      handler: async (ctx) => {
        if (!ctx.chat || ctx.chat.type === 'private') {
          const personaId = getSetting(ctx, 'persona') || 'tsundere';
          const persona = getPersonality(personaId, ctx);
          await ctx.reply(
            persona.strings?.notGroupChat ?? 'This command is only available in groups.',
          );
          return;
        }

        const isAdmin = await isGroupAdmin(ctx);
        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        if (!isAdmin) {
          await ctx.reply(
            persona.strings?.notGroupAdmin ??
              'Only group admins can configure chatty mode.',
          );
          return;
        }

        const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
        const mode = args[0]?.toLowerCase();

        if (mode === 'on') {
          setGroupSetting(ctx.chat.id, { chatty: 1 });
          await ctx.reply(
            persona.strings?.chattyEnabled ??
              'Chatty mode enabled! Bot will occasionally chime into group conversations (~5% chance).',
          );
          return;
        }

        if (mode === 'off') {
          setGroupSetting(ctx.chat.id, { chatty: 0 });
          await ctx.reply(
            persona.strings?.chattyDisabled ??
              'Chatty mode disabled. Bot will only respond when mentioned or replied to.',
          );
          return;
        }

        const current = getGroupSettings(ctx.chat.id);
        const statusStr = current.chatty ? 'Active (ON)' : 'Disabled (OFF)';
        await ctx.reply(
          `*Chatty Mode Status:*\n` +
            `• Status: *${statusStr}*\n` +
            `• Response chance: *${Math.round(current.chatty_prob * 100)}%*\n` +
            `• Cooldown: *1 minute*\n\n` +
            `Change settings: \`/chatty on\` or \`/chatty off\` (admin only).`,
          { parse_mode: 'Markdown' },
        );
      },
    },
    {
      name: 'welcome',
      description: 'Enable/disable new member greetings in group (/welcome [on|off])',
      handler: async (ctx) => {
        if (!ctx.chat || ctx.chat.type === 'private') {
          const personaId = getSetting(ctx, 'persona') || 'tsundere';
          const persona = getPersonality(personaId, ctx);
          await ctx.reply(
            persona.strings?.notGroupChat ?? 'This command is only available in groups.',
          );
          return;
        }

        const isAdmin = await isGroupAdmin(ctx);
        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        if (!isAdmin) {
          await ctx.reply(
            persona.strings?.notGroupAdmin ??
              'Only group admins can configure member greetings.',
          );
          return;
        }

        const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
        const mode = args[0]?.toLowerCase();

        if (mode === 'on') {
          setGroupSetting(ctx.chat.id, { welcome_enabled: 1 });
          await ctx.reply(
            persona.strings?.welcomeEnabled ??
              'New member greeting enabled.',
          );
          return;
        }

        if (mode === 'off') {
          setGroupSetting(ctx.chat.id, { welcome_enabled: 0 });
          await ctx.reply(
            persona.strings?.welcomeDisabled ??
              'New member greeting disabled.',
          );
          return;
        }

        const current = getGroupSettings(ctx.chat.id);
        const statusStr = current.welcome_enabled ? 'Active (ON)' : 'Disabled (OFF)';
        await ctx.reply(
          `*New Member Greeting Status:*\n` +
            `• Status: *${statusStr}*\n\n` +
            `Change settings: \`/welcome on\` or \`/welcome off\` (admin only).`,
          { parse_mode: 'Markdown' },
        );
      },
    },
  ],
};
