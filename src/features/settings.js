import { InlineKeyboard } from 'grammy';
import { getSetting, setSetting, isValidTimezone } from '../core/settings.js';
import { listPersonalities } from '../personalities/index.js';

function getPersona(ctx) {
  return ctx?.persona ?? { strings: {} };
}

export function renderMainMenu(ctx) {
  const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
  const gifFreq = getSetting(ctx, 'gif_freq', 'normal');
  const personaId = getSetting(ctx, 'persona', 'tsundere');
  const lang = getSetting(ctx, 'lang', 'en');

  const p = getPersona(ctx);
  const header = p.strings?.settingsHeader ?? '*Bot Settings:*';

  const text = [
    header,
    '',
    `• Timezone: \`${tz}\``,
    `• GIF Frequency: \`${gifFreq}\``,
    `• Persona: \`${personaId}\``,
    `• Output Language: \`English (Global)\``,
    '',
    'Select an option below to configure:',
  ].join('\n');

  const keyboard = new InlineKeyboard()
    .text('Timezone', 'set:menu:tz')
    .text('GIF Frequency', 'set:menu:gif')
    .row()
    .text('Persona', 'set:menu:persona')
    .text('Language', 'set:menu:lang')
    .row()
    .text('Close', 'set:close');

  return { text, keyboard };
}

export function renderTzMenu() {
  const text = [
    '*Timezone Settings*',
    '',
    'Quick-select a timezone or configure manually with:',
    '`/timezone Asia/Makassar`',
  ].join('\n');

  const keyboard = new InlineKeyboard()
    .text('WIB (Jakarta)', 'set:val:tz:Asia/Jakarta')
    .text('WITA (Makassar)', 'set:val:tz:Asia/Makassar')
    .row()
    .text('WIT (Jayapura)', 'set:val:tz:Asia/Jayapura')
    .row()
    .text('Back', 'set:menu:main');

  return { text, keyboard };
}

function renderGifMenu() {
  const text = [
    '*GIF Frequency*',
    '',
    'Set how often the bot sends GIF animations:',
  ].join('\n');

  const keyboard = new InlineKeyboard()
    .text('Off', 'set:val:gif_freq:off')
    .text('Rare (1/10)', 'set:val:gif_freq:rare')
    .row()
    .text('Normal (1/4)', 'set:val:gif_freq:normal')
    .text('Often (1/2)', 'set:val:gif_freq:often')
    .row()
    .text('Back', 'set:menu:main');

  return { text, keyboard };
}

const PERSONA_LABELS = {
  tsundere: 'Raka (Tsundere)',
  manis: 'Rio (Sweet)',
  ceria: 'Nando (Cheerful)',
  sarkas: 'Kael (Sarcastic)',
  jiang_cheng: 'Jiang Cheng (Exclusive)',
  custom: 'Custom Persona',
};

export function renderPersonaMenu() {
  const personas = listPersonalities();
  const keyboard = new InlineKeyboard();

  personas.forEach((id, idx) => {
    const label = PERSONA_LABELS[id] || id;
    keyboard.text(label, `set:val:persona:${id}`);
    if (idx % 2 === 1) keyboard.row();
  });
  if (personas.length % 2 !== 0) keyboard.row();
  keyboard.text('Back', 'set:menu:main');

  const text = '*Select Active Persona:*\n(Per-chat persona setting)';
  return { text, keyboard };
}

function renderLangMenu() {
  const text =
    '*Output Language:*\n\nJibun Bot output is globally English. You can chat in any language (Indonesian, Japanese, etc.), and the bot will understand and respond in English.';
  const keyboard = new InlineKeyboard()
    .text('English (Default)', 'set:val:lang:en')
    .row()
    .text('Back', 'set:menu:main');

  return { text, keyboard };
}

export default {
  id: 'settings',

  commands: [
    {
      name: 'settings',
      description: 'Configure bot preferences (timezone, GIF, language, persona)',
      handler: async (ctx) => {
        const { text, keyboard } = renderMainMenu(ctx);
        await ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      },
    },
    {
      name: 'timezone',
      description: 'Change timezone (example: /timezone Asia/Makassar)',
      handler: async (ctx) => {
        const p = getPersona(ctx);
        const args = ctx.message.text.split(/\s+/).slice(1);
        const inputTz = args[0]?.trim();

        if (!inputTz) {
          const currentTz = getSetting(ctx, 'tz', 'Asia/Jakarta');
          await ctx.reply(
            `Your current timezone: ${currentTz}\nTo change it, type: /timezone <iana_name>\nExample: /timezone Asia/Makassar or /timezone Europe/London`,
          );
          return;
        }

        if (!isValidTimezone(inputTz)) {
          const errMsg =
            p.strings?.tzInvalid ??
            `Timezone format '${inputTz}' is invalid. Use a valid IANA name like Asia/Jakarta or Asia/Makassar.`;
          await ctx.reply(errMsg);
          return;
        }

        setSetting(ctx, 'tz', inputTz);

        const successMsg =
          p.strings?.tzSuccess?.replace('{tz}', inputTz) ??
          `Timezone successfully changed to ${inputTz}.`;
        await ctx.reply(successMsg);
      },
    },
  ],

  callbacks: [
    {
      prefix: 'set:',
      handler: async (ctx) => {
        const data = ctx.callbackQuery.data; // e.g. set:menu:tz or set:val:tz:Asia/Jakarta

        if (data === 'set:close') {
          await ctx.deleteMessage().catch(() => {});
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        if (data === 'set:menu:main') {
          const { text, keyboard } = renderMainMenu(ctx);
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          }).catch(() => {});
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        if (data === 'set:menu:tz') {
          const { text, keyboard } = renderTzMenu();
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          }).catch(() => {});
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        if (data === 'set:menu:gif') {
          const { text, keyboard } = renderGifMenu();
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          }).catch(() => {});
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        if (data === 'set:menu:persona') {
          const { text, keyboard } = renderPersonaMenu();
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          }).catch(() => {});
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        if (data === 'set:menu:lang') {
          const { text, keyboard } = renderLangMenu();
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          }).catch(() => {});
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        // Penanganan pemilihan nilai: set:val:<key>:<value>
        if (data.startsWith('set:val:')) {
          const parts = data.slice('set:val:'.length).split(':');
          const key = parts[0];
          const val = parts.slice(1).join(':');

          try {
            setSetting(ctx, key, val);
            const p = getPersona(ctx);
            const savedMsg = p.strings?.settingsSaved ?? 'Pengaturan berhasil diperbarui.';
            await ctx.answerCallbackQuery({ text: savedMsg }).catch(() => {});

            // Kembali ke menu utama dengan status terbaru
            const { text, keyboard } = renderMainMenu(ctx);
            await ctx.editMessageText(text, {
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            }).catch(() => {});
          } catch (err) {
            await ctx.answerCallbackQuery({ text: err.message }).catch(() => {});
          }
        }
      },
    },
  ],
};

