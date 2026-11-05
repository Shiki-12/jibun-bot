import { InlineKeyboard } from 'grammy';
import { getSetting, setSetting } from '../core/settings.js';
import { isGroupAdmin } from '../core/groups.js';
import {
  getPersonality,
  listPersonalities,
  upsertCustomPersona,
} from '../personalities/index.js';

export { isGroupAdmin };

export function renderPersonaSelector(currentPersonaId = 'tsundere') {
  const defaultPersonas = [
    { id: 'tsundere', name: 'Raka (Tsundere)' },
    { id: 'manis', name: 'Rio (Sweet)' },
    { id: 'ceria', name: 'Nando (Cheerful)' },
    { id: 'sarkas', name: 'Kael (Sarcastic)' },
  ];

  const exclusivePersonas = [
    { id: 'jiang_cheng', name: 'Jiang Cheng (Mo Dao Zu Shi)' },
  ];

  const lines = [
    '*Change Bot Personality*',
    '',
    `Active personality: *${currentPersonaId}*`,
    '',
    'Select a character below to switch, or create your own custom personality with:',
    '`/persona custom <description>`',
  ];

  const keyboard = new InlineKeyboard();

  // 1. Default Personalities
  defaultPersonas.forEach((p, idx) => {
    const activeMark = p.id === currentPersonaId ? ' [Active]' : '';
    keyboard.text(`${p.name}${activeMark}`, `persona:set:${p.id}`);
    if (idx % 2 === 1) keyboard.row();
  });

  // 2. Exclusive Personalities
  keyboard.row();
  exclusivePersonas.forEach((p) => {
    const activeMark = p.id === currentPersonaId ? ' [Active]' : '';
    keyboard.text(`${p.name}${activeMark}`, `persona:set:${p.id}`).row();
  });

  // 3. Custom Persona
  const customActiveMark = currentPersonaId === 'custom' ? ' [Active]' : '';
  keyboard.text(`Custom Persona${customActiveMark}`, 'persona:set:custom');

  return { text: lines.join('\n'), keyboard };
}

export default {
  id: 'persona',

  commands: [
    {
      name: 'persona',
      description: 'Switch bot personality or configure a custom persona (/persona [name/custom <description>])',
      handler: async (ctx) => {
        const isAdmin = await isGroupAdmin(ctx);
        if (!isAdmin) {
          await ctx.reply('Only group administrators can change the bot personality.');
          return;
        }

        const args = ctx.message.text.split(/\s+/).slice(1);
        const subCommand = args[0]?.toLowerCase();

        // 1. Tampilkan menu selector jika tanpa argumen
        if (!subCommand) {
          const current = getSetting(ctx, 'persona', 'tsundere');
          const { text, keyboard } = renderPersonaSelector(current);
          await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
          return;
        }

        // 2. Persona custom: /persona custom <deskripsi>
        if (subCommand === 'custom') {
          const description = args.slice(1).join(' ').trim();
          if (!description) {
            await ctx.reply(
              'Describe the character you want. Maximum 800 characters.\n\nExample:\n`/persona custom A genius scientist assistant who explains physics through coffee brewing analogies.`',
              { parse_mode: 'Markdown' },
            );
            return;
          }

          if (description.length > 800) {
            await ctx.reply(
              `Description is too long (${description.length} characters). Maximum 800 characters!`,
            );
            return;
          }

          const chatId = ctx.chat.id;
          const userId = ctx.from.id;
          upsertCustomPersona({ chatId, userId, description, name: 'Custom' });
          setSetting(ctx, 'persona', 'custom');

          await ctx.reply(
            '*Custom Persona Successfully Activated!*\nSafety rules and base formatting are automatically applied.',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        // 3. Ganti ke persona bawaan: /persona manis / ceria / sarkas / tsundere
        const available = listPersonalities();
        if (!available.includes(subCommand)) {
          await ctx.reply(
            `Persona "${subCommand}" not found. Options: ${available.join(', ')}`,
          );
          return;
        }

        setSetting(ctx, 'persona', subCommand);
        let newPersona;
        try {
          newPersona = getPersonality(subCommand, ctx);
        } catch {
          newPersona = { name: subCommand, greeting: 'Hello!' };
        }

        const changeMsg = `Bot personality successfully changed to *${newPersona.name}* (${subCommand})!\n\n_${newPersona.greeting}_`;
        await ctx.reply(changeMsg, { parse_mode: 'Markdown' });
      },
    },
  ],

  callbacks: [
    {
      prefix: 'persona:set:',
      handler: async (ctx) => {
        const isAdmin = await isGroupAdmin(ctx);
        if (!isAdmin) {
          await ctx.answerCallbackQuery({
            text: 'Only group administrators can change the persona.',
            show_alert: true,
          }).catch(() => {});
          return;
        }

        const targetId = ctx.callbackQuery.data.slice('persona:set:'.length);
        const available = listPersonalities();

        if (!available.includes(targetId)) {
          await ctx.answerCallbackQuery({ text: 'Invalid persona.' }).catch(() => {});
          return;
        }

        setSetting(ctx, 'persona', targetId);
        let newPersona;
        try {
          newPersona = getPersonality(targetId, ctx);
        } catch {
          newPersona = { name: targetId, greeting: 'Hello!' };
        }

        const activeNotice = `Active persona: ${newPersona.name}`;
        await ctx.answerCallbackQuery({
          text: activeNotice,
        }).catch(() => {});

        const { text, keyboard } = renderPersonaSelector(targetId);
        const switchNotice = `${text}\n\n_Persona successfully changed to ${newPersona.name}!_`;

        await ctx
          .editMessageText(
            switchNotice,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            },
          )
          .catch(() => {});
      },
    },
  ],
};

