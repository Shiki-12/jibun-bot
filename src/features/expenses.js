import { InputFile, InlineKeyboard } from 'grammy';
import { getSetting } from '../core/settings.js';
import {
  parseExpenseAmount,
  formatRupiah,
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  addExpense,
  getExpenseById,
  deleteExpense,
  updateExpenseCategory,
  getExpensesSummary,
  generateExpensesCsv,
} from '../core/expenses.js';

/**
 * Build inline keyboard to correct expense category.
 */
export function buildCategoryKeyboard(expenseId) {
  return new InlineKeyboard()
    .text('Food', `exp:cat:${expenseId}:makanan`)
    .text('Transport', `exp:cat:${expenseId}:transport`)
    .text('Shopping', `exp:cat:${expenseId}:belanja`)
    .row()
    .text('Bills', `exp:cat:${expenseId}:tagihan`)
    .text('Entertainment', `exp:cat:${expenseId}:hiburan`)
    .text('Health', `exp:cat:${expenseId}:kesehatan`)
    .row()
    .text('Other', `exp:cat:${expenseId}:lainnya`);
}

export default {
  id: 'expenses',

  commands: [
    {
      name: 'catat',
      description: 'Record expense (/catat <amount> <note>, example: /catat 25k lunch)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const userId = ctx.from?.id;
        if (!userId) return;

        const raw = ctx.message?.text?.trim() || '';
        const parts = raw.split(/\s+/).slice(1);

        if (parts.length === 0) {
          await ctx.reply(
            'Command format: `/catat <amount> <note>`\n' +
              'Examples:\n' +
              '• `/catat 25k lunch`\n' +
              '• `/catat 50rb gasoline`\n' +
              '• `/catat 1,5jt rent`\n' +
              '• `/catat 25.000 groceries`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const amountRaw = parts[0];
        const noteRaw = parts.slice(1).join(' ').trim() || 'Expense';

        try {
          const exp = addExpense({
            userId,
            amount: amountRaw,
            note: noteRaw,
          });

          const catLabel = CATEGORY_LABELS[exp.category] || exp.category;
          const template =
            p.strings?.expenseRecorded ??
            '*Expense Recorded!*\n' +
              '• Amount: *{amount}*\n' +
              '• Category: *{category}*\n' +
              '• Note: "{note}"';

          const replyText = template
            .replace('{amount}', formatRupiah(exp.amount))
            .replace('{category}', catLabel)
            .replace('{note}', exp.note);

          const footer = '\n\n_Correct category if needed:_';
          await ctx.reply(`${replyText}${footer}`, {
            parse_mode: 'Markdown',
            reply_markup: buildCategoryKeyboard(exp.id),
          });
        } catch (err) {
          await ctx.reply(`[Error] ${err.message}`);
        }
      },
    },
    {
      name: 'rekap',
      description: 'View expense summary (/rekap, /rekap minggu, /rekap bulan)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const userId = ctx.from?.id;
        if (!userId) return;

        const raw = ctx.message?.text?.trim() || '';
        const parts = raw.split(/\s+/).slice(1);
        const periodArg = parts[0]?.toLowerCase() || 'hari';

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const summary = getExpensesSummary({ userId, period: periodArg, tz });

        if (summary.totalCount === 0) {
          const emptyMsg =
            p.strings?.expenseEmpty ??
            `No expenses recorded for *${summary.periodLabel}*.`;
          await ctx.reply(emptyMsg, { parse_mode: 'Markdown' });
          return;
        }

        const headerTemplate =
          p.strings?.expenseRekapHeader ??
          '*Expense Summary ({period}):*';
        const header = headerTemplate.replace('{period}', summary.periodLabel);

        const lines = summary.breakdown.map((item) => {
          return `• ${item.label}: *${formatRupiah(item.amount)}* (${item.percentage}% - ${item.count}x)`;
        });

        const totalStr = `\n*Total Expenses:* *${formatRupiah(summary.totalAmount)}* (${summary.totalCount} transactions)`;
        const footer =
          '\n\n_Other commands:_\n' +
          '• `/rekap hari` (Today)\n' +
          '• `/rekap minggu` (This week)\n' +
          '• `/rekap bulan` (This month)\n' +
          '• `/exportcsv` (Download CSV report)';

        await ctx.reply(
          `${header}\n\n${lines.join('\n')}\n${totalStr}${footer}`,
          { parse_mode: 'Markdown' },
        );
      },
    },
    {
      name: 'hapuscatat',
      description: 'Delete expense record by ID (/hapuscatat <id>)',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const userId = ctx.from?.id;
        if (!userId) return;

        const raw = ctx.message?.text?.trim() || '';
        const parts = raw.split(/\s+/).slice(1);
        const expenseId = parseInt(parts[0], 10);

        if (isNaN(expenseId)) {
          await ctx.reply('Use format: `/hapuscatat <id>`\nExample: `/hapuscatat 5`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const ok = deleteExpense(expenseId, userId);
        if (ok) {
          const template =
            p.strings?.expenseDeleted ??
            'Expense record #{id} deleted.';
          await ctx.reply(template.replace('{id}', expenseId));
        } else {
          const template =
            p.strings?.expenseNotFound ??
            'Expense record #{id} not found.';
          await ctx.reply(template.replace('{id}', expenseId));
        }
      },
    },
    {
      name: 'exportcsv',
      description: 'Download full expense history as CSV file',
      handler: async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
        const csvContent = generateExpensesCsv(userId, tz);

        // Jika hanya ada 1 baris header, berarti belum ada data
        if (!csvContent.includes('\n')) {
          await ctx.reply('No expense history available to export.');
          return;
        }

        try {
          const fileBuffer = Buffer.from(csvContent, 'utf-8');
          const fileName = `expenses_${userId}.csv`;
          await ctx.replyWithDocument(new InputFile(fileBuffer, fileName), {
            caption: 'Here is your expense report (CSV format).',
          });
        } catch (err) {
          console.error('Failed to send CSV file:', err);
          await ctx.reply('[Error] Failed to generate expense CSV file.');
        }
      },
    },
  ],

  callbacks: [
    {
      prefix: 'exp:',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const data = ctx.callbackQuery?.data || '';
        // Format: exp:cat:<id>:<category>
        const parts = data.split(':');
        const action = parts[1];
        const expenseId = parseInt(parts[2], 10);
        const newCat = parts[3];
        const userId = ctx.from?.id;

        if (action !== 'cat' || isNaN(expenseId) || !userId) {
          await ctx.answerCallbackQuery({ text: 'Invalid button data.' });
          return;
        }

        const existing = getExpenseById(expenseId, userId);
        if (!existing) {
          await ctx.answerCallbackQuery({
            text: 'Expense record not found.',
          });
          return;
        }

        try {
          updateExpenseCategory(expenseId, userId, newCat);
          const catLabel = CATEGORY_LABELS[newCat] || newCat;

          await ctx.answerCallbackQuery({
            text: `Category changed to: ${catLabel}`,
          });

          const template =
            p.strings?.expenseCategoryUpdated ??
            'Expense #{id} category changed to *{category}*.';
          const updateText = template
            .replace('{id}', expenseId)
            .replace('{category}', catLabel);

          const fullMsg =
            `*Expense Updated!*\n` +
            `• ID: #${existing.id}\n` +
            `• Amount: *${formatRupiah(existing.amount)}*\n` +
            `• Category: *${catLabel}*\n` +
            `• Note: "${existing.note}"\n\n` +
            `_${updateText}_`;

          await ctx.editMessageText(fullMsg, {
            parse_mode: 'Markdown',
            reply_markup: buildCategoryKeyboard(existing.id),
          });
        } catch (err) {
          await ctx.answerCallbackQuery({ text: err.message });
        }
      },
    },
  ],

  tags: [
    {
      name: 'EXPENSE',
      promptHint:
        'Record user expense. Format: [EXPENSE: amount | category | note]. Example: [EXPENSE: 25000 | makanan | lunch], [EXPENSE: 50000 | transport | gas]. Category options: makanan, transport, belanja, tagihan, hiburan, kesehatan, lainnya. Use this tag when user spent money.',
      handle: async (ctx, args) => {
        const rawAmount = args?.[0]?.trim();
        const rawCategory = args?.[1]?.trim()?.toLowerCase();
        const rawNote = args?.[2]?.trim() || 'Expense';
        const userId = ctx.from?.id;

        if (!rawAmount || !userId) return;

        try {
          const exp = addExpense({
            userId,
            amount: rawAmount,
            category: EXPENSE_CATEGORIES.includes(rawCategory) ? rawCategory : null,
            note: rawNote,
          });

          const p = ctx.persona ?? { strings: {} };
          const catLabel = CATEGORY_LABELS[exp.category] || exp.category;
          const template =
            p.strings?.expenseRecorded ??
            '*Expense Recorded!*\n' +
              '• Amount: *{amount}*\n' +
              '• Category: *{category}*\n' +
              '• Note: "{note}"';

          const replyText = template
            .replace('{amount}', formatRupiah(exp.amount))
            .replace('{category}', catLabel)
            .replace('{note}', exp.note);

          await ctx.reply(replyText, {
            parse_mode: 'Markdown',
            reply_markup: buildCategoryKeyboard(exp.id),
          });
        } catch (err) {
          console.error('Failed to process tag [EXPENSE]:', err.message);
        }
      },
    },
  ],
};

