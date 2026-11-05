import { selectBestPhoto, downloadPhotoAsBase64, buildPhotoPlaceholder } from '../core/vision.js';

export default {
  id: 'vision',
  commands: [
    {
      name: 'vision',
      description: 'Image analysis guide (vision)',
      handler: async (ctx) => {
        const text =
          '*Image Analysis Feature (Vision)*\n\n' +
          'Send a photo directly to the chat (with or without a caption).\n' +
          '• In private chat: The bot inspects and responds to your photo immediately.\n' +
          '• In groups: Mention the bot or reply to the bot with a photo.\n' +
          '• File size limit: maximum *20 MB*.\n\n' +
          '_The bot persona will comment on your photo according to its character!_';
        await ctx.reply(text, { parse_mode: 'Markdown' });
      },
    },
  ],
  init: async ({ bot, handleChatMessage }) => {
    if (!bot || typeof bot.on !== 'function') return;

    bot.on('message:photo', async (ctx) => {
      const photos = ctx.message?.photo;
      if (!photos || photos.length === 0) return;

      const isPrivate = ctx.chat.type === 'private';
      const botMention = `@${ctx.me?.username || ''}`;
      let caption = ctx.message.caption || '';

      // Di grup, hanya jawab jika di-mention atau me-reply bot
      if (!isPrivate) {
        const mentioned =
          botMention.length > 1 && caption.toLowerCase().includes(botMention.toLowerCase());
        const repliedToBot = ctx.message.reply_to_message?.from?.id === ctx.me?.id;
        if (!mentioned && !repliedToBot) return;

        if (botMention.length > 1) {
          caption = caption.replace(new RegExp(botMention, 'gi'), '').trim();
        }
      }

      // Pilih resolusi terbaik yang masih dalam batas aman (maks 20 MB)
      const bestPhoto = selectBestPhoto(photos);
      if (!bestPhoto) {
        const tooLarge =
          ctx.persona?.strings?.visionTooLarge ??
          'Photo size is too large or invalid (maximum 20 MB).';
        await ctx.reply(tooLarge);
        return;
      }

      try {
        await ctx.replyWithChatAction('typing');

        const imageDataUrl = await downloadPhotoAsBase64({
          api: ctx.api,
          botToken: process.env.TELEGRAM_BOT_TOKEN || 'dummy_token',
          fileId: bestPhoto.file_id,
        });

        const placeholder = isPrivate
          ? buildPhotoPlaceholder(caption)
          : `${ctx.from?.first_name || 'User'}: ${
              caption ? `[sent photo: ${caption}]` : '[sent photo]'
            }`;

        const replyOptions = isPrivate
          ? {}
          : { reply_parameters: { message_id: ctx.message.message_id } };

        if (typeof handleChatMessage === 'function') {
          await handleChatMessage(ctx, caption || 'What is in this photo?', isPrivate, replyOptions, {
            vision: {
              imageUrl: imageDataUrl,
              caption: caption || 'What is in this photo? Please explain.',
              placeholder,
            },
          });
        }
      } catch (err) {
        console.error('Error processing photo:', err.message);
        const errMsg =
          ctx.persona?.strings?.visionDownloadFailed ??
          'Failed to download photo from Telegram. Please try sending it again.';
        await ctx.reply(errMsg).catch(() => {});
      }
    });
  },
};
