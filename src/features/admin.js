import { InlineKeyboard } from 'grammy';
import { isAdmin } from '../core/guards.js';
import {
  getAdminStats,
  banUser,
  unbanUser,
  isUserBanned,
  listBannedUsers,
  isMaintenanceMode,
  setMaintenanceMode,
  getActiveModel,
  setActiveModel,
  createPendingBroadcast,
  getPendingBroadcast,
  deletePendingBroadcast,
  executeBroadcast,
  logAdminAction,
} from '../core/admin.js';
import { getDb } from '../core/db.js';
import { getSetting } from '../core/settings.js';
import { getPersonality } from '../personalities/index.js';

export default {
  id: 'admin',

  commands: [
    {
      name: 'stats',
      description: 'Bot operational statistics (admin only)',
      adminOnly: true,
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          return;
        }

        const stats = getAdminStats();
        const msg = [
          '*Bot Operational Statistics*',
          '',
          '*Users & Activity:*',
          `• Total Users: *${stats.totalUsers}*`,
          `• Total Chats/Groups: *${stats.totalChats}*`,
          `• Active Users Today: *${stats.activeUsersToday}*`,
          `• Messages Today: *${stats.messagesToday}*`,
          '',
          '*System Status:*',
          `• Active LLM Model: \`${stats.activeModel}\``,
          `• Maintenance Mode: *${stats.isMaintenance ? 'ON (Active)' : 'OFF (Normal)'}*`,
          `• Banned Users: *${stats.bannedCount}*`,
          `• Active Reminders (Pending): *${stats.pendingReminders}*`,
          `• Stored Facts (Memory): *${stats.factsCount}*`,
          `• Expense Records: *${stats.expensesCount}* (Total: Rp ${stats.expensesTotal.toLocaleString('id-ID')})`,
          '',
          '*Token Usage & LLM Performance (Today):*',
          `• Total Tokens: *${stats.tokensToday.toLocaleString('id-ID')}* (${stats.promptTokensToday.toLocaleString('id-ID')} prompt, ${stats.completionTokensToday.toLocaleString('id-ID')} completion)`,
          `• Average Latency: *${stats.avgLatencyMs} ms*`,
          stats.usageByModel && stats.usageByModel.length > 0
            ? `• Models Used: ${stats.usageByModel.map((m) => `\`${m.model}\` (${m.tokens.toLocaleString('id-ID')})`).join(', ')}`
            : '• Models Used: _(no calls today)_',
        ].join('\n');

        await ctx.reply(msg, { parse_mode: 'Markdown' });
      },
    },
    {
      name: 'ban',
      description: 'Ban user from bot access (/ban <user_id> [reason])',
      adminOnly: true,
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          return;
        }

        const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
        const targetId = Number(args[0]);
        const reason = args.slice(1).join(' ').trim() || 'Rule violation';

        if (!targetId || isNaN(targetId) || targetId <= 0) {
          await ctx.reply(
            'Invalid format!\nUsage: `/ban <user_id> [reason]`\nExample: `/ban 123456789 spamming`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        if (isAdmin(targetId)) {
          await ctx.reply('Cannot ban a fellow bot admin!');
          return;
        }

        try {
          banUser({ userId: targetId, reason, adminId: ctx.from.id });
          await ctx.reply(
            `*User Successfully Banned!*\n• User ID: \`${targetId}\`\n• Reason: ${reason}`,
            { parse_mode: 'Markdown' },
          );
        } catch (err) {
          await ctx.reply(`Failed to ban user: ${err.message}`);
        }
      },
    },
    {
      name: 'unban',
      description: 'Unban user (/unban <user_id>)',
      adminOnly: true,
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          return;
        }

        const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
        const targetId = Number(args[0]);

        if (!targetId || isNaN(targetId) || targetId <= 0) {
          await ctx.reply(
            'Invalid format!\nUsage: `/unban <user_id>`\nExample: `/unban 123456789`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const success = unbanUser({ userId: targetId, adminId: ctx.from.id });
        if (success) {
          await ctx.reply(
            `*User Successfully Unbanned!*\n• User ID: \`${targetId}\``,
            { parse_mode: 'Markdown' },
          );
        } else {
          await ctx.reply(`User ID \`${targetId}\` not found in banned list.`, {
            parse_mode: 'Markdown',
          });
        }
      },
    },
    {
      name: 'broadcast',
      description: 'Broadcast message to all registered users (/broadcast <text>)',
      adminOnly: true,
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          return;
        }

        const text = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();
        if (!text) {
          await ctx.reply(
            'Invalid format!\nUsage: `/broadcast <announcement message>`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const db = getDb();
        const targetCount =
          db.prepare('SELECT count(*) as c FROM users WHERE id > 0').get()?.c ?? 0;

        const bcId = createPendingBroadcast({
          adminId: ctx.from.id,
          text,
          targetCount,
        });

        const keyboard = new InlineKeyboard()
          .text('Send Now', `adm:bc:send:${bcId}`)
          .text('Cancel', `adm:bc:cancel:${bcId}`);

        const previewMsg = [
          '*Broadcast Confirmation*',
          '',
          `• Target Recipients: *${targetCount} users*`,
          '',
          '*Message Content:*',
          text,
          '',
          'Are you sure you want to broadcast this message to all registered users?',
        ].join('\n');

        await ctx.reply(previewMsg, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      },
    },
    {
      name: 'model',
      description: 'Check or temporarily change active LLM model (/model [model_name])',
      adminOnly: true,
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          return;
        }

        const newModel = ctx.message?.text?.split(/\s+/).slice(1).join(' ').trim();

        if (!newModel) {
          const current = getActiveModel();
          await ctx.reply(
            `*Current LLM Model:*\n\`${current}\`\n\nTo temporarily change model without restart:\n\`/model <model_name>\``,
            { parse_mode: 'Markdown' },
          );
          return;
        }

        try {
          setActiveModel(newModel, ctx.from.id);
          await ctx.reply(
            `*LLM Model Successfully Changed!*\nActive model now: \`${newModel}\`\nChanges take effect immediately for subsequent calls.`,
            { parse_mode: 'Markdown' },
          );
        } catch (err) {
          await ctx.reply(`Failed to change model: ${err.message}`);
        }
      },
    },
    {
      name: 'maintenance',
      description: 'Set bot maintenance mode (/maintenance [on|off])',
      adminOnly: true,
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          return;
        }

        const mode = ctx.message?.text?.split(/\s+/)[1]?.toLowerCase();

        if (mode === 'on') {
          setMaintenanceMode(true, ctx.from.id);
          await ctx.reply(
            '*Maintenance Mode Enabled (ON)*\nNon-admin users cannot access or call the bot.',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        if (mode === 'off') {
          setMaintenanceMode(false, ctx.from.id);
          await ctx.reply(
            '*Maintenance Mode Disabled (OFF)*\nBot is active again for all users.',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const current = isMaintenanceMode();
        await ctx.reply(
          `*Maintenance Mode Status:*\n• Status: *${current ? 'ON (Active)' : 'OFF (Inactive)'}*\n\nUsage: \`/maintenance on\` or \`/maintenance off\`.`,
          { parse_mode: 'Markdown' },
        );
      },
    },
    {
      name: 'cleanreminders',
      description: 'Clean up failed & invalid chat reminders (admin only)',
      adminOnly: true,
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) return;

        const db = getDb();
        const invalidRows = db.prepare(`
          SELECT r.id, r.chat_id, r.text, r.status
          FROM reminders r
          WHERE r.status = 'failed'
             OR (
               r.chat_id > 0
               AND r.chat_id NOT IN (SELECT id FROM users)
             )
             OR r.chat_id IN (880011, 880022, 880033, 880044, 440011, 7771234, 8889991)
        `).all();

        if (invalidRows.length === 0) {
          await ctx.reply('No invalid reminders found to clean up.');
          return;
        }

        const previewList = invalidRows
          .slice(0, 5)
          .map((r) => `• #${r.id} (chat: \`${r.chat_id}\`): "${r.text}"`)
          .join('\n');

        const keyboard = new InlineKeyboard()
          .text(`Delete ${invalidRows.length} Reminders`, 'adm:cleanrem:confirm')
          .text('Cancel', 'adm:cleanrem:cancel');

        const msg = [
          '*Confirmation: Clean Up Invalid Reminders*',
          '',
          `Found *${invalidRows.length}* reminders with 'failed' status or invalid chat IDs:`,
          previewList,
          invalidRows.length > 5 ? `_...and ${invalidRows.length - 5} more_` : '',
          '',
          'Are you sure you want to delete these reminders from the database?',
        ].filter(Boolean).join('\n');

        await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
      },
    },
  ],

  callbacks: [
    {
      prefix: 'adm:cleanrem:confirm',
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          await ctx.answerCallbackQuery({ text: 'Access denied.' }).catch(() => {});
          return;
        }

        const db = getDb();
        const res = db.prepare(`
          DELETE FROM reminders
          WHERE status = 'failed'
             OR (
               chat_id > 0
               AND chat_id NOT IN (SELECT id FROM users)
             )
             OR chat_id IN (880011, 880022, 880033, 880044, 440011, 7771234, 8889991)
        `).run();

        logAdminAction({
          adminId: ctx.from.id,
          action: 'clean_reminders',
          details: `Deleted ${res.changes} invalid reminders`,
        });

        await ctx.answerCallbackQuery({ text: 'Cleanup successful!' }).catch(() => {});
        await ctx.editMessageText(`*Cleanup Completed!*\nSuccessfully deleted *${res.changes}* invalid reminders from database.`, {
          parse_mode: 'Markdown',
        }).catch(() => {});
      },
    },
    {
      prefix: 'adm:cleanrem:cancel',
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          await ctx.answerCallbackQuery({ text: 'Access denied.' }).catch(() => {});
          return;
        }
        await ctx.answerCallbackQuery({ text: 'Cancelled.' }).catch(() => {});
        await ctx.editMessageText('*Reminder cleanup cancelled.*', {
          parse_mode: 'Markdown',
        }).catch(() => {});
      },
    },
    {
      prefix: 'adm:bc:send:',
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          await ctx.answerCallbackQuery({ text: 'Access denied.' }).catch(() => {});
          return;
        }

        const bcId = ctx.callbackQuery.data.slice('adm:bc:send:'.length);
        const bc = getPendingBroadcast(bcId);

        if (!bc) {
          await ctx.answerCallbackQuery({
            text: 'Broadcast data expired or not found.',
          }).catch(() => {});
          return;
        }

        deletePendingBroadcast(bcId);
        await ctx.answerCallbackQuery({ text: 'Starting broadcast delivery...' }).catch(() => {});

        await ctx.editMessageText('*Broadcasting to all users...*', {
          parse_mode: 'Markdown',
        }).catch(() => {});

        const botApi = ctx.api || ctx.bot?.api;
        const result = await executeBroadcast({
          bot: { api: botApi },
          text: bc.text,
          delayMs: 30,
        });

        logAdminAction({
          adminId: ctx.from.id,
          action: 'broadcast',
          details: `Total: ${result.total}, Success: ${result.successCount}, Failed: ${result.failCount}`,
        });

        const reportMsg = [
          '*Broadcast Delivery Completed!*',
          '',
          `• Total Target: *${result.total}*`,
          `• Successful: *${result.successCount}*`,
          `• Failed / Blocked: *${result.failCount}*`,
        ].join('\n');

        await ctx.editMessageText(reportMsg, { parse_mode: 'Markdown' }).catch(() => {});
      },
    },
    {
      prefix: 'adm:bc:cancel:',
      handler: async (ctx) => {
        if (!isAdmin(ctx.from?.id)) {
          await ctx.answerCallbackQuery({ text: 'Access denied.' }).catch(() => {});
          return;
        }

        const bcId = ctx.callbackQuery.data.slice('adm:bc:cancel:'.length);
        deletePendingBroadcast(bcId);

        await ctx.answerCallbackQuery({ text: 'Broadcast cancelled.' }).catch(() => {});
        await ctx.editMessageText('*Broadcast cancelled.*', {
          parse_mode: 'Markdown',
        }).catch(() => {});
      },
    },
  ],
};

