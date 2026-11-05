import {
  evaluateMath,
  convertCurrency,
  convertUnit,
  formatCurrencyAmount,
} from '../core/converter.js';

export default {
  id: 'converter',

  commands: [
    {
      name: 'kurs',
      description: 'Check currency exchange rates (/kurs 100 usd idr or /kurs usd idr)',
      handler: async (ctx) => {
        const rawArg = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();

        if (!rawArg) {
          await ctx.reply(
            '*Currency conversion format:*\n' +
              '• `/kurs <amount> <from> <to>` (example: `/kurs 100 USD IDR`)\n' +
              '• `/kurs <from> <to>` (example: `/kurs USD IDR` for amount of 1)',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const parts = rawArg.split(/\s+/);
        let amount = 1;
        let fromCurr = '';
        let toCurr = '';

        if (parts.length === 2) {
          fromCurr = parts[0];
          toCurr = parts[1];
        } else if (parts.length >= 3) {
          const parsed = parseFloat(parts[0].replace(',', '.'));
          if (!isNaN(parsed)) {
            amount = parsed;
            fromCurr = parts[1];
            toCurr = parts[2];
          } else {
            fromCurr = parts[0];
            toCurr = parts[1];
          }
        } else {
          await ctx.reply(
            'Invalid format. Example: `/kurs 100 USD IDR` or `/kurs USD IDR`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        try {
          await ctx.replyWithChatAction('typing');

          const conv = await convertCurrency(amount, fromCurr, toCurr);

          const replyText =
            `*Currency Conversion:*\n` +
            `*${formatCurrencyAmount(conv.amount)} ${conv.from}* = *${formatCurrencyAmount(conv.result)} ${conv.to}*\n\n` +
            `• *Exchange Rate:* 1 ${conv.from} = ${formatCurrencyAmount(conv.rate)} ${conv.to}\n` +
            `• *Updated:* ${conv.lastUpdateUtc}`;

          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('Error during currency conversion:', err);
          await ctx.reply(`Failed currency conversion: ${err.message}`);
        }
      },
    },
    {
      name: 'hitung',
      description: 'Calculate math expression (/hitung 15 * (4 + 2) ^ 2)',
      handler: async (ctx) => {
        const expr = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();

        if (!expr) {
          await ctx.reply(
            '*Calculator format:*\n' +
              'Use `/hitung <expression>`\n' +
              'Example: `/hitung 15 * (4 + 2)` or `/hitung 2 ^ 3 + 10 % 3`\n\n' +
              '_Supported operators: +, -, *, /, %, ^, and parentheses ()_',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        try {
          const result = evaluateMath(expr);
          await ctx.reply(
            `*Calculation Result:*\n\`${expr}\` = *${result}*`,
            { parse_mode: 'Markdown' },
          );
        } catch (err) {
          await ctx.reply(`[Error] Calculation failed: ${err.message}`);
        }
      },
    },
    {
      name: 'konversi',
      description: 'Convert units of length, weight, temperature, and volume (/konversi 5 km mil)',
      handler: async (ctx) => {
        const rawArg = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();

        if (!rawArg) {
          await ctx.reply(
            '*Unit conversion format:*\n' +
              'Use `/konversi <value> <from> <to>`\n\n' +
              'Examples:\n' +
              '• Length: `/konversi 5 km mil` or `/konversi 100 cm m`\n' +
              '• Weight: `/konversi 2.5 kg lb` or `/konversi 500 g ons`\n' +
              '• Temperature: `/konversi 100 c f` or `/konversi 300 k c`\n' +
              '• Volume: `/konversi 1 gal l` or `/konversi 500 ml cangkir`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        // Hapus kata 'ke' atau 'to' jika user menuliskan "/konversi 5 km ke mil"
        const tokens = rawArg.split(/\s+/).filter((t) => !['ke', 'to'].includes(t.toLowerCase()));

        if (tokens.length < 3) {
          await ctx.reply('Invalid format. Usage example: `/konversi 5 km mil`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const [valStr, fromUnit, toUnit] = tokens;

        try {
          const conv = convertUnit(valStr, fromUnit, toUnit);

          const replyText =
            `*Unit Conversion (${conv.category}):*\n` +
            `*${conv.value} ${conv.from}* = *${conv.result} ${conv.to}*`;

          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          await ctx.reply(`[Error] ${err.message}`);
        }
      },
    },
  ],

  tags: [
    {
      name: 'CALC',
      promptHint:
        'Calculate math expression. Format: [CALC: expression] (example: [CALC: 15 * (4 + 2)]). Emit this tag when user asks for calculation assistance.',
      handle: async (ctx, args) => {
        const expr = args?.[0]?.trim();
        if (!expr) return;
        try {
          const result = evaluateMath(expr);
          await ctx.reply(`*Calculation Result:*\n\`${expr}\` = *${result}*`, {
            parse_mode: 'Markdown',
          });
        } catch (err) {
          console.error(`Failed to process tag [CALC: ${expr}]:`, err.message);
        }
      },
    },
    {
      name: 'KURS',
      promptHint:
        'Check currency exchange rate. Format: [KURS: amount | from_currency | to_currency] (example: [KURS: 100 | USD | IDR]).',
      handle: async (ctx, args) => {
        if (!args || args.length < 2) return;
        let amount = 1;
        let fromCurr = '';
        let toCurr = '';

        if (args.length === 2) {
          fromCurr = args[0].trim();
          toCurr = args[1].trim();
        } else {
          amount = parseFloat(args[0].trim().replace(',', '.')) || 1;
          fromCurr = args[1].trim();
          toCurr = args[2].trim();
        }

        try {
          const conv = await convertCurrency(amount, fromCurr, toCurr);
          const replyText =
            `*Currency Conversion:*\n` +
            `*${formatCurrencyAmount(conv.amount)} ${conv.from}* = *${formatCurrencyAmount(conv.result)} ${conv.to}*\n\n` +
            `• *Exchange Rate:* 1 ${conv.from} = ${formatCurrencyAmount(conv.rate)} ${conv.to}`;
          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error(`Failed to process tag [KURS]:`, err.message);
        }
      },
    },
    {
      name: 'CONVERT',
      promptHint:
        'Convert units of measurement. Format: [CONVERT: value | from_unit | to_unit] (example: [CONVERT: 5 | km | mil]).',
      handle: async (ctx, args) => {
        if (!args || args.length < 3) return;
        const val = args[0].trim();
        const from = args[1].trim();
        const to = args[2].trim();

        try {
          const conv = convertUnit(val, from, to);
          const replyText =
            `*Unit Conversion (${conv.category}):*\n` +
            `*${conv.value} ${conv.from}* = *${conv.result} ${conv.to}*`;
          await ctx.reply(replyText, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error(`Failed to process tag [CONVERT]:`, err.message);
        }
      },
    },
  ],
};

