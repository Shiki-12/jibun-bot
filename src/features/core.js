import { clearHistory } from '../memory.js';
import { clearSummary } from '../core/facts.js';
import { getPersonality, listPersonalities } from '../personalities/index.js';
import { searchGif } from '../giphy.js';
import { getSetting, getEffectivePersona } from '../core/settings.js';
import { isAdmin } from '../core/guards.js';

let activeCommandsGetter = () => [];

function resolvePersona(ctx) {
  if (ctx?.persona) return ctx.persona;
  const { persona } = getEffectivePersona(ctx);
  return persona;
}

export default {
  id: 'core',

  init: async ({ getActiveCommands }) => {
    if (typeof getActiveCommands === 'function') {
      activeCommandsGetter = getActiveCommands;
    }
  },

  commands: [
    {
      name: 'start',
      description: 'Start conversation with the bot',
      handler: async (ctx) => {
        const persona = resolvePersona(ctx);
        const isGroup = ctx.chat?.type && ctx.chat.type !== 'private';
        if (isGroup) {
          const botUser = ctx.me?.username ? `@${ctx.me.username}` : 'bot';
          const groupIntro =
            `${persona.greeting}\n\n` +
            '*Group Usage Information:*\n' +
            `• The bot only responds when mentioned (${botUser}) or replied to (unless admin enables /chatty on).\n` +
            '• The bot keeps a 200-message buffer in this group for the /rangkum_grup summary feature.\n' +
            '• Ensure *Group Privacy* is disabled via @BotFather or promote the bot to Group Admin so it can read messages for summaries.';
          await ctx.reply(groupIntro, { parse_mode: 'Markdown' });
          return;
        }
        await ctx.reply(persona.greeting);
      },
    },
    {
      name: 'forget',
      description: 'Clear conversation history in this chat',
      handler: async (ctx) => {
        clearHistory(ctx.chat.id);
        clearSummary(ctx.chat.id);
        const persona = resolvePersona(ctx);
        const text =
          persona.strings?.forgetSuccess ??
          'Past conversation history has been cleared.';
        await ctx.reply(text);
      },
    },
    {
      name: 'about',
      description: 'Information about the bot and active persona',
      handler: async (ctx) => {
        const { persona, id, source } = getEffectivePersona(ctx);
        const meta = persona?.category === 'exclusive' ? ` [Exclusive: ${persona.source ?? 'Fan-inspired'}]` : '';
        const text = `Active personality: ${persona.name} (${id})${meta} [source: ${source}]\nAvailable: ${listPersonalities().join(', ')}`;
        await ctx.reply(text);
      },
    },
    {
      name: 'help',
      description: 'View list of available commands',
      handler: async (ctx) => {
        const persona = resolvePersona(ctx);
        const allCommands = activeCommandsGetter();
        const userId = ctx.from?.id;
        const userIsAdmin = isAdmin(userId);

        const publicCommands = allCommands.filter((c) => !c.adminOnly);
        const adminCommands = allCommands.filter((c) => c.adminOnly);

        const header =
          persona.strings?.helpHeader ?? 'List of available commands:';
        const footer = persona.strings?.helpFooter ?? '';

        const publicList = publicCommands
          .map((c) => `/${c.name} — ${c.description || 'No description'}`)
          .join('\n');

        const parts = [header, '', publicList];

        if (userIsAdmin && adminCommands.length > 0) {
          const adminList = adminCommands
            .map((c) => `/${c.name} — ${c.description || 'No description'}`)
            .join('\n');
          parts.push('', 'Admin only:', adminList);
        }

        if (footer) parts.push('', footer);

        await ctx.reply(parts.join('\n'));
      },
    },
  ],

  tags: [
    {
      name: 'GIF',
      minArgs: 1,
      maxArgs: 1,
      maxArgLength: 100,
      promptHint:
        'Kirim animasi GIF jika momennya tepat. Format: [GIF: kata kunci dalam bahasa Inggris]. Contoh: [GIF: anime blush]',
      handle: async (ctx, [query]) => {
        const gifFreq = getSetting(ctx, 'gif_freq', 'normal');
        if (gifFreq === 'off') return;
        try {
          const gifUrl = await searchGif(query);
          if (gifUrl) await ctx.replyWithAnimation(gifUrl);
        } catch (err) {
          console.error('Gagal kirim GIF:', err.message);
        }
      },
    },
  ],
};

