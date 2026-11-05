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
      description: 'Mulai percakapan dengan bot',
      handler: async (ctx) => {
        const persona = resolvePersona(ctx);
        const isGroup = ctx.chat?.type && ctx.chat.type !== 'private';
        const isEn = persona?.language === 'en' || persona?.id === 'jiang_cheng';
        if (isGroup) {
          const botUser = ctx.me?.username ? `@${ctx.me.username}` : 'bot';
          const groupIntro = isEn
            ? `${persona.greeting}\n\n` +
              '*Group Usage Information:*\n' +
              `• The bot only responds when mentioned (${botUser}) or replied to (unless admin enables /chatty on).\n` +
              '• The bot keeps a 200-message buffer in this group for the /rangkum_grup summary feature.\n' +
              '• Ensure *Group Privacy* is disabled via @BotFather or promote the bot to Group Admin so it can read messages for summaries.'
            : `${persona.greeting}\n\n` +
              '*Informasi Penggunaan Grup:*\n' +
              `• Bot hanya merespons jika di-mention (${botUser}) atau pesannya di-reply (kecuali admin menyalakan /chatty on).\n` +
              '• Bot menyimpan penyangga 200 pesan teks terakhir di grup ini untuk fitur ringkasan /rangkum_grup.\n' +
              '• Pastikan *Group Privacy* dimatikan di @BotFather atau jadikan bot Admin grup agar bot dapat membaca pesan untuk fitur ringkasan.';
          await ctx.reply(groupIntro, { parse_mode: 'Markdown' });
          return;
        }
        await ctx.reply(persona.greeting);
      },
    },
    {
      name: 'forget',
      description: 'Hapus riwayat percakapan di chat ini',
      handler: async (ctx) => {
        clearHistory(ctx.chat.id);
        clearSummary(ctx.chat.id);
        const persona = resolvePersona(ctx);
        const text =
          persona.strings?.forgetSuccess ??
          'Hah, kamu mau aku lupa semuanya? ...Ya udah, terserah. Aku nggak peduli kok. (¬_¬)';
        await ctx.reply(text);
      },
    },
    {
      name: 'about',
      description: 'Info tentang persona dan bot',
      handler: async (ctx) => {
        const { persona, id, source } = getEffectivePersona(ctx);
        const isEn = persona?.language === 'en' || persona?.id === 'jiang_cheng';
        const meta = persona?.category === 'exclusive' ? ` [Exclusive: ${persona.source ?? 'Fan-inspired'}]` : '';
        const text = isEn
          ? `Active personality: ${persona.name} (${id})${meta} [source: ${source}]\nAvailable: ${listPersonalities().join(', ')}`
          : `Personality aktif: ${persona.name} (${id})${meta} [sumber: ${source}]\nTersedia: ${listPersonalities().join(', ')}`;
        await ctx.reply(text);
      },
    },
    {
      name: 'help',
      description: 'Lihat daftar perintah yang tersedia',
      handler: async (ctx) => {
        const persona = resolvePersona(ctx);
        const allCommands = activeCommandsGetter();
        const userId = ctx.from?.id;
        const userIsAdmin = isAdmin(userId);
        const isEn = persona?.language === 'en' || persona?.id === 'jiang_cheng';

        const publicCommands = allCommands.filter((c) => !c.adminOnly);
        const adminCommands = allCommands.filter((c) => c.adminOnly);

        const header =
          persona.strings?.helpHeader ?? (isEn ? 'List of available commands:' : 'Daftar perintah yang bisa kamu pakai:');
        const footer = persona.strings?.helpFooter ?? '';

        const publicList = publicCommands
          .map((c) => `/${c.name} — ${c.description || (isEn ? 'No description' : 'Tidak ada deskripsi')}`)
          .join('\n');

        const parts = [header, '', publicList];

        if (userIsAdmin && adminCommands.length > 0) {
          const adminList = adminCommands
            .map((c) => `/${c.name} — ${c.description || (isEn ? 'No description' : 'Tidak ada deskripsi')}`)
            .join('\n');
          parts.push('', isEn ? 'Admin only:' : 'Khusus admin:', adminList);
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

