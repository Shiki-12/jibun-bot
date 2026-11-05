import {
  translateText,
  summarizeText,
  parseTranslateArgs,
  parseSummarizeArgs,
} from '../core/translator.js';
import { getSetting } from '../core/settings.js';
import { getPersonality } from '../personalities/index.js';
import { sanitizeReply } from '../core/kaomoji.js';

/**
 * Kirim balasan dengan aman ke Telegram (membagi pesan jika melebihi 4000 karakter).
 * @param {object} ctx
 * @param {string} fullText
 */
async function safeReply(ctx, fullText) {
  if (fullText.length <= 4000) {
    return await ctx.reply(fullText);
  }

  let remaining = fullText;
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, 3800);
    remaining = remaining.slice(3800);
    await ctx.reply(chunk);
  }
}

export default {
  id: 'translator',

  commands: [
    {
      name: 'terjemah',
      description: 'Translate text to another language (/terjemah <language> <text> or reply to message)',
      handler: async (ctx) => {
        const rawArgs = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim() || '';
        const replyText =
          ctx.message?.reply_to_message?.text ||
          ctx.message?.reply_to_message?.caption ||
          '';

        const parsed = parseTranslateArgs(rawArgs, replyText);

        if (parsed.missingLang || (!parsed.text && !parsed.isReply)) {
          await ctx.reply(
            'Translation Command Format:\n' +
              '• /terjemah <language> <text>\n' +
              '  Example: /terjemah en Good morning, how are you?\n' +
              '• Reply to a message with: /terjemah <language>\n' +
              '  Example reply: /terjemah en or /terjemah japanese',
          );
          return;
        }

        if (!parsed.text) {
          await ctx.reply('Please provide the text to translate or reply to a message containing text.');
          return;
        }

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        try {
          if (typeof ctx.replyWithChatAction === 'function') {
            await ctx.replyWithChatAction('typing').catch(() => {});
          }

          const res = await translateText({
            text: parsed.text,
            targetLang: parsed.targetLang,
          });

          const intro =
            typeof persona.strings?.translateIntro === 'function'
              ? persona.strings.translateIntro(res.targetLang)
              : `Here is the translation into ${res.targetLang}:`;

          await safeReply(ctx, sanitizeReply(`${intro}\n\n${res.translatedText}`));
        } catch (err) {
          if (err.message === 'URL_BLOCKED') {
            const blockedMsg =
              persona.strings?.translateUrlBlocked ||
              'URL links are not opened automatically for security (SSRF protection). Please copy and paste the text directly.';
            await ctx.reply(blockedMsg);
            return;
          }

          if (err.message === 'INVALID_LANGUAGE') {
            await ctx.reply(
              `Target language "${parsed.targetLang}" is not recognized. Example: "en", "id", "japanese", "korean", "arabic", "chinese", "german", etc.`,
            );
            return;
          }

          console.error('Error translating text:', err);
          await ctx.reply(persona.errorMessage || 'An error occurred while translating text.');
        }
      },
    },
    {
      name: 'rangkum',
      description: 'Summarize long text or replied message (/rangkum <text> or reply to message)',
      handler: async (ctx) => {
        const rawArgs = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim() || '';
        const replyText =
          ctx.message?.reply_to_message?.text ||
          ctx.message?.reply_to_message?.caption ||
          '';

        const parsed = parseSummarizeArgs(rawArgs, replyText);

        if (!parsed.text) {
          await ctx.reply(
            'Summary Command Format:\n' +
              '• /rangkum <long text>\n' +
              '• Reply to a long message with /rangkum',
          );
          return;
        }

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        try {
          if (typeof ctx.replyWithChatAction === 'function') {
            await ctx.replyWithChatAction('typing').catch(() => {});
          }

          const res = await summarizeText({ text: parsed.text });

          const intro =
            persona.strings?.summarizeIntro ||
            'Here is the summary of key points:';

          await safeReply(ctx, sanitizeReply(`${intro}\n\n${res.summaryText}`));
        } catch (err) {
          if (err.message === 'URL_BLOCKED') {
            const blockedMsg =
              persona.strings?.summarizeUrlBlocked ||
              'URL links are not fetched automatically for security (SSRF protection). Please copy and paste the article text here.';
            await ctx.reply(blockedMsg);
            return;
          }

          if (err.message === 'TEXT_TOO_SHORT') {
            await ctx.reply('Text is too short to summarize. Please provide a longer article or paragraph.');
            return;
          }

          console.error('Error summarizing text:', err);
          await ctx.reply(persona.errorMessage || 'An error occurred while summarizing text.');
        }
      },
    },
  ],

  tags: [
    {
      name: 'TRANSLATE',
      promptHint:
        'Translate text into target language. Format: [TRANSLATE: target_language | text]. Example: [TRANSLATE: en | Good morning]. Emit this tag when user asks for translation help.',
      handle: async (ctx, args) => {
        if (!args || args.length < 2) return;
        const targetLang = args[0]?.trim();
        const text = args.slice(1).join(' | ').trim();
        if (!targetLang || !text) return;

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        try {
          const res = await translateText({ text, targetLang });
          const intro =
            typeof persona.strings?.translateIntro === 'function'
              ? persona.strings.translateIntro(res.targetLang)
              : `Here is the translation into ${res.targetLang}:`;

          await safeReply(ctx, sanitizeReply(`${intro}\n\n${res.translatedText}`));
        } catch (err) {
          console.error(`Failed processing [TRANSLATE] tag:`, err.message);
        }
      },
    },
    {
      name: 'SUMMARIZE',
      promptHint:
        'Summarize long text into concise key points. Format: [SUMMARIZE: text]. Example: [SUMMARIZE: long article text]. Emit this tag when user asks to summarize text.',
      handle: async (ctx, args) => {
        if (!args || args.length < 1) return;
        const text = args.join(' | ').trim();
        if (!text) return;

        const personaId = getSetting(ctx, 'persona') || 'tsundere';
        const persona = getPersonality(personaId, ctx);

        try {
          const res = await summarizeText({ text });
          const intro =
            persona.strings?.summarizeIntro ||
            'Here is the summary of key points:';

          await safeReply(ctx, sanitizeReply(`${intro}\n\n${res.summaryText}`));
        } catch (err) {
          console.error(`Failed processing [SUMMARIZE] tag:`, err.message);
        }
      },
    },
  ],
};

