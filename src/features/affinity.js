import { getSetting } from '../core/settings.js';
import { getAffinity, getLevelInfo } from '../core/affinity.js';

function getPersona(ctx) {
  return ctx?.persona ?? { strings: {} };
}

export function buildProgressBar(points, minPoints, nextThreshold, isEn = false) {
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

export function renderStatusCard(aff, persona) {
  const p = persona ?? { strings: {} };
  const isEn = p.language === 'en' || p.id === 'jiang_cheng';
  const info = getLevelInfo(aff.level);
  const bar = buildProgressBar(aff.points, info.minPoints, aff.nextThreshold, isEn);
  const title = p.affinityTitles?.[aff.level] ?? aff.title ?? info.title;

  const statusQuotes = p.strings?.affinityStatus ?? [
    'Kita masih orang asing.',
    'Mulai sering mengobrol ya.',
    'Aku mulai terbiasa dengan kehadiranmu.',
    'Kamu salah satu orang terdekatku.',
    'Kamu orang yang paling berharga untukku.',
  ];

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
      ];

  return lines.join('\n');
}

export default {
  id: 'affinity',

  commands: [
    {
      name: 'status',
      description: 'Lihat level kedekatan (affinity) dan progres hubunganmu dengan bot',
      handler: async (ctx) => {
        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const persona = getPersona(ctx);
        const aff = getAffinity(ctx.from.id, tz, Date.now(), persona?.id);

        const cardText = renderStatusCard(aff, persona);
        await ctx.reply(cardText, { parse_mode: 'Markdown' });
      },
    },
  ],
};

