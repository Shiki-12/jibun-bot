import { InlineKeyboard } from 'grammy';
import { getSetting, getEffectivePersona } from '../core/settings.js';
import { getAffinity, getLevelInfo, setAffinityLevel } from '../core/affinity.js';
import { getPersonality } from '../personalities/index.js';

export const ENGLISH_AFFINITY_TITLES = [
  'Stranger',
  'Familiar Face',
  'Growing Trust',
  'Trusted Companion',
  'Deep Trust',
];

export const DEFAULT_EN_STATUS_QUOTES = [
  'We are still strangers. Do not overstep your bounds.',
  'I have grown accustomed to how you speak. Keep your conduct proper.',
  'I know you can be relied upon. That is progress.',
  'If there is a serious issue, speak up. I will listen.',
  'The trust I give is not easily granted. Do not waste it.',
];

export const DEFAULT_ID_STATUS_QUOTES = [
  'Kita masih orang asing.',
  'Mulai sering mengobrol ya.',
  'Aku mulai terbiasa dengan kehadiranmu.',
  'Kamu salah satu orang terdekatku.',
  'Kamu orang yang paling berharga untukku.',
];

function getPersona(ctx) {
  if (ctx?.persona) return ctx.persona;
  try {
    const eff = getEffectivePersona(ctx);
    if (eff?.persona) return eff.persona;
  } catch {}
  return { strings: {} };
}

export function buildProgressBar(points, minPoints, nextThreshold, isEn = true) {
  if (nextThreshold === null) {
    return isEn
      ? '`[██████████]` *(Max Level)*'
      : '`[██████████]` *(Level Maksimal)*';
  }

  const span = Math.max(1, nextThreshold - minPoints);
  const currentInLevel = Math.max(0, points - minPoints);
  const fraction = Math.min(1, Math.max(0, currentInLevel / span));
  const filledBlocks = Math.round(fraction * 10);
  const emptyBlocks = 10 - filledBlocks;

  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  const unit = isEn ? 'points' : 'poin';
  return `\`[${bar}]\` *${points}/${nextThreshold}* ${unit}`;
}

export function renderAffinityPicker(userId, persona, currentLevel = 0) {
  const keyboard = new InlineKeyboard();
  const titles = persona?.affinityTitles ?? ENGLISH_AFFINITY_TITLES;
  for (let lvl = 0; lvl <= 4; lvl++) {
    const title = titles[lvl] ?? `Level ${lvl}`;
    const activeMark = lvl === currentLevel ? ' [Active]' : '';
    keyboard.text(`[${lvl}] ${title}${activeMark}`, `aff:set:${userId}:${persona?.id || 'tsundere'}:${lvl}`);
    keyboard.row();
  }
  return keyboard;
}

export function renderAffinityPickerText(persona, aff) {
  const title = persona?.affinityTitles?.[aff.level] ?? ENGLISH_AFFINITY_TITLES[aff.level] ?? aff.title;
  return [
    '*Set Relationship Affinity Level:*',
    '',
    `Active personality: *${persona.name}*`,
    `Current level: *Level ${aff.level} — "${title}"* (${aff.points} points)`,
    '',
    'Select your desired affinity level below, or use `/setaffinity <0-4|min|max>`:',
  ].join('\n');
}

export function getAffinityUsageMessage() {
  return [
    'Invalid affinity level. Please choose a level from 0 to 4 (or "min" / "max").',
    '',
    'Usage:',
    '• `/setaffinity` — Show level picker menu',
    '• `/setaffinity <0-4|min|max>` — Set level instantly',
  ].join('\n');
}

export function renderStatusCard(aff, persona) {
  let p = persona;
  if (typeof p === 'string') {
    try {
      p = getPersonality(p);
    } catch {
      p = { id: p, strings: {} };
    }
  } else if (!p && aff?.personaId) {
    try {
      p = getPersonality(aff.personaId);
    } catch {
      p = { id: aff.personaId, strings: {} };
    }
  }
  p = p ?? { strings: {} };

  const isEn = p.language !== 'id';
  const info = getLevelInfo(aff.level);
  const nextThreshold = aff.nextThreshold !== undefined ? aff.nextThreshold : info.nextThreshold;
  const bar = buildProgressBar(aff.points, info.minPoints, nextThreshold, isEn);

  let title;
  if (isEn) {
    title = p.affinityTitles?.[aff.level] ?? ENGLISH_AFFINITY_TITLES[aff.level] ?? aff.title ?? info.title;
  } else {
    title = p.affinityTitles?.[aff.level] ?? aff.title ?? info.title;
  }

  const defaultQuotes = isEn ? DEFAULT_EN_STATUS_QUOTES : DEFAULT_ID_STATUS_QUOTES;
  const statusQuotes =
    Array.isArray(p.strings?.affinityStatus) && p.strings.affinityStatus.length > 0
      ? p.strings.affinityStatus
      : defaultQuotes;

  const quote = statusQuotes[aff.level] ?? statusQuotes[0];

  const lines = isEn
    ? [
        `*Relationship & Affinity Status:*`,
        '',
        `• Level: *${aff.level}* — *"${title}"*`,
        `• Total Points: *${aff.points}* points`,
        `• Level Progress: ${bar}`,
        `• Points Today: *${aff.gainedToday}/${aff.dailyCap}* points`,
        '',
        `"${quote}"`,
        '',
        `_Use /setaffinity to change your affinity level._`,
      ]
    : [
        `*Status Hubungan & Kedekatan:*`,
        '',
        `• Level: *${aff.level}* — *"${title}"*`,
        `• Total Poin: *${aff.points}* poin`,
        `• Progres Level: ${bar}`,
        `• Poin Hari Ini: *${aff.gainedToday}/${aff.dailyCap}* poin`,
        '',
        `"${quote}"`,
        '',
        `_Gunakan /setaffinity untuk mengubah level kedekatan._`,
      ];

  return lines.join('\n');
}

export default {
  id: 'affinity',

  commands: [
    {
      name: 'status',
      description: 'View relationship affinity level and progress with the bot',
      handler: async (ctx) => {
        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const persona = getPersona(ctx);
        const aff = getAffinity(ctx.from.id, tz, Date.now(), persona?.id);

        const cardText = renderStatusCard(aff, persona);
        const keyboard = new InlineKeyboard().text(
          'Change Affinity Level',
          `aff:menu:${ctx.from.id}:${persona?.id || 'tsundere'}`,
        );
        await ctx.reply(cardText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      },
    },
    {
      name: 'setaffinity',
      description: 'Set relationship affinity level with active persona (/setaffinity [0-4|min|max])',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const persona = getPersona(ctx);
        const text = ctx.message?.text || '';
        const args = text.trim().split(/\s+/).slice(1);
        const sub = args[0]?.toLowerCase();

        // 1. Tampilkan menu picker jika tanpa argumen
        if (!sub) {
          const aff = getAffinity(userId, tz, Date.now(), persona?.id);
          const pickerText = renderAffinityPickerText(persona, aff);
          const keyboard = renderAffinityPicker(userId, persona, aff.level);
          await ctx.reply(pickerText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
          return;
        }

        // 2. Reject jika terdapat extra tokens
        if (args.length > 1) {
          await ctx.reply(getAffinityUsageMessage());
          return;
        }

        // 3. Validasi token level
        let targetLevel;
        if (sub === 'min') {
          targetLevel = 0;
        } else if (sub === 'max') {
          targetLevel = 4;
        } else if (/^[0-4]$/.test(sub)) {
          targetLevel = parseInt(sub, 10);
        } else {
          await ctx.reply(getAffinityUsageMessage());
          return;
        }

        // 4. Perbarui level di database
        const updated = setAffinityLevel(userId, persona?.id, targetLevel, tz, Date.now());
        const title = persona.affinityTitles?.[targetLevel] ?? ENGLISH_AFFINITY_TITLES[targetLevel];
        const defaultQuotes = DEFAULT_EN_STATUS_QUOTES;
        const quotes =
          Array.isArray(persona.strings?.affinityStatus) && persona.strings.affinityStatus.length > 0
            ? persona.strings.affinityStatus
            : defaultQuotes;
        const quote = quotes[targetLevel] ?? quotes[0];

        const replyText = [
          `Relationship affinity with *${persona.name}* set to *Level ${targetLevel} — "${title}"* (${updated.points} points).`,
          '',
          `"${quote}"`,
        ].join('\n');

        await ctx.reply(replyText, { parse_mode: 'Markdown' });
      },
    },
  ],

  callbacks: [
    {
      prefix: 'aff:set:',
      handler: async (ctx) => {
        const raw = ctx.callbackQuery?.data?.slice('aff:set:'.length) || '';
        const parts = raw.split(':');
        const ownerId = Number(parts[0]);
        const pId = parts[1];
        const lvl = parseInt(parts[2], 10);

        // Verifikasi pemilik menu
        if (ctx.from?.id !== ownerId) {
          await ctx.answerCallbackQuery({
            text: 'You cannot change affinity for another user.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        // Verifikasi batas level yang valid
        if (!Number.isInteger(lvl) || lvl < 0 || lvl > 4) {
          await ctx.answerCallbackQuery({
            text: 'Invalid affinity level.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        // Verifikasi kesesuaian persona aktif
        const activePersona = getPersona(ctx);
        if (activePersona.id !== pId) {
          await ctx.answerCallbackQuery({
            text: 'Active personality has changed. Please run /setaffinity again.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const updated = setAffinityLevel(ownerId, pId, lvl, tz, Date.now());
        const title = activePersona.affinityTitles?.[lvl] ?? ENGLISH_AFFINITY_TITLES[lvl];

        await ctx.answerCallbackQuery({
          text: `Affinity set to Level ${lvl} (${title})!`,
        }).catch(() => {});

        const pickerText = renderAffinityPickerText(activePersona, updated);
        const keyboard = renderAffinityPicker(ownerId, activePersona, lvl);
        const confirmation = `${pickerText}\n\n_Affinity successfully updated to Level ${lvl}!_`;

        await ctx.editMessageText(confirmation, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }).catch(() => {});
      },
    },
    {
      prefix: 'aff:menu:',
      handler: async (ctx) => {
        const raw = ctx.callbackQuery?.data?.slice('aff:menu:'.length) || '';
        const parts = raw.split(':');
        const ownerId = Number(parts[0]);
        const pId = parts[1];

        if (ctx.from?.id !== ownerId) {
          await ctx.answerCallbackQuery({
            text: 'You cannot change affinity for another user.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        const activePersona = getPersona(ctx);
        if (activePersona.id !== pId) {
          await ctx.answerCallbackQuery({
            text: 'Active personality has changed. Please run /setaffinity again.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        await ctx.answerCallbackQuery().catch(() => {});

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const aff = getAffinity(ownerId, tz, Date.now(), pId);
        const pickerText = renderAffinityPickerText(activePersona, aff);
        const keyboard = renderAffinityPicker(ownerId, activePersona, aff.level);

        await ctx.editMessageText(pickerText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }).catch(() => {});
      },
    },
  ],
};

