import { InlineKeyboard } from 'grammy';
import {
  MOOD_LEVELS,
  hasCrisisSigns,
  recordMood,
  getUserMoodsLast7Days,
  renderMoodWeekSummary,
} from '../core/moods.js';
import { getSetting } from '../core/settings.js';

export const MEDICAL_DISCLAIMER =
  '_Note: This journal feature is for personal reflection and is NOT a substitute for professional therapy, counseling, or medical diagnosis._';

export const CRISIS_RESPONSE =
  'Please do not say things like that... I am here listening to you. You are not alone and your feelings matter. Please reach out to someone you trust or official support services immediately:\n' +
  '• Hotline SEJIWA Kemenkes RI: Telepon 119 (ekstensi 8)\n' +
  '• Halo Kemenkes: 1500-567\n' +
  '• Layanan Darurat Nasional: 112\n' +
  '• Or the nearest medical facility (Puskesmas / ER). Please take good care of yourself.';

function buildMoodKeyboard() {
  return new InlineKeyboard()
    .text('1 (T_T)', 'mood:set:1')
    .text('2 (._.)', 'mood:set:2')
    .text('3 (-_-)', 'mood:set:3')
    .text('4 (^_^)', 'mood:set:4')
    .text('5 (^▽^)', 'mood:set:5');
}

export function getPersonaMoodComment(persona, score) {
  const p = persona ?? { strings: {} };
  const numScore = Number(score);

  if (p.strings?.moodFeedback) {
    if (numScore <= 2 && p.strings.moodFeedback.low) return p.strings.moodFeedback.low;
    if (numScore === 3 && p.strings.moodFeedback.neutral) return p.strings.moodFeedback.neutral;
    if (numScore >= 4 && p.strings.moodFeedback.high) return p.strings.moodFeedback.high;
  }

  // Fallback umum netral
  if (numScore <= 2) {
    return 'A tough day... Take a rest and do not be too hard on yourself.';
  }
  if (numScore === 3) {
    return 'Note saved. May the rest of your day go smoothly and calmly.';
  }
  return 'Glad to hear you are having a good day! Keep up the positive energy!';
}

export default {
  id: 'moods',

  commands: [
    {
      name: 'mood',
      description: 'Record daily mood (1-5 scale, optional note)',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const text = ctx.message?.text ?? '';
        const parts = text.split(/\s+/).slice(1);
        const scoreArg = parts[0];

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');

        // Jika user memanggil /mood tanpa argumen atau format bukan 1-5
        if (!scoreArg || isNaN(parseInt(scoreArg, 10)) || parseInt(scoreArg, 10) < 1 || parseInt(scoreArg, 10) > 5) {
          const prompt =
            `*Daily Mood Check-in*\n\n` +
            `How are you feeling right now? Choose on a scale from 1 to 5:\n\n` +
            `• 1: Very Bad (T_T)\n` +
            `• 2: Bad (._.)\n` +
            `• 3: Neutral (-_-)\n` +
            `• 4: Good (^_^)\n` +
            `• 5: Very Good (^▽^)\n\n` +
            `_You can also type:_\n\`/mood <1-5> [note]\`\nExample: \`/mood 4 Had a great day!\`\n\n` +
            `${MEDICAL_DISCLAIMER}`;

          await ctx.reply(prompt, {
            parse_mode: 'Markdown',
            reply_markup: buildMoodKeyboard(),
          });
          return;
        }

        const score = parseInt(scoreArg, 10);
        const note = parts.slice(1).join(' ').trim() || null;

        // Cek indikasi krisis keselamatan
        if (note && hasCrisisSigns(note)) {
          recordMood({ userId, score, note, tz });
          await ctx.reply(CRISIS_RESPONSE);
          return;
        }

        const saved = recordMood({ userId, score, note, tz });
        const meta = MOOD_LEVELS[score] || { emoji: '(-_-)', label: 'Neutral' };
        const comment = getPersonaMoodComment(ctx.persona, score);
        const notePart = saved.note ? `\n*Note:* _"${saved.note}"_` : '';

        const replyMsg =
          `*Mood Saved!* (${score}/5 ${meta.emoji} — ${meta.label})${notePart}\n\n` +
          `${comment}\n\n` +
          `${MEDICAL_DISCLAIMER}`;

        await ctx.reply(replyMsg, { parse_mode: 'Markdown' });
      },
    },

    {
      name: 'moodweek',
      description: 'View 7-day mood journal summary',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const rows = getUserMoodsLast7Days(userId);

        if (rows.length === 0) {
          await ctx.reply(
            `No mood records in the last 7 days.\nType \`/mood\` to start tracking how you feel! (^_^)\n\n${MEDICAL_DISCLAIMER}`,
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const summary = renderMoodWeekSummary(rows, tz);
        await ctx.reply(summary, { parse_mode: 'Markdown' });
      },
    },
  ],

  callbacks: [
    {
      prefix: 'mood:set:',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const data = ctx.callbackQuery?.data ?? '';
        const scoreStr = data.replace('mood:set:', '');
        const score = parseInt(scoreStr, 10);

        if (isNaN(score) || score < 1 || score > 5) {
          await ctx.answerCallbackQuery({ text: 'Invalid selection!' });
          return;
        }

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        recordMood({ userId, score, note: null, tz });

        const meta = MOOD_LEVELS[score] || { emoji: '(-_-)', label: 'Neutral' };
        const comment = getPersonaMoodComment(ctx.persona, score);

        const resultText =
          `*Mood Saved!* (${score}/5 ${meta.emoji} — ${meta.label})\n\n` +
          `${comment}\n\n` +
          `_Tip: You can also write a journal note, example:_\n\`/mood ${score} finished all work today\`\n\n` +
          `${MEDICAL_DISCLAIMER}`;

        await ctx.editMessageText(resultText, { parse_mode: 'Markdown' });
        await ctx.answerCallbackQuery({ text: `Mood ${score}/5 saved!` });
      },
    },
  ],
};

