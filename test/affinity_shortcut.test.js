import './setup.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/core/db.js';
import {
  getAffinity,
  recordInteraction,
  setAffinityLevel,
  LEVEL_TARGET_POINTS,
  DAILY_POINTS_CAP,
} from '../src/core/affinity.js';
import affinityFeature, {
  renderAffinityPicker,
  renderAffinityPickerText,
  renderStatusCard,
} from '../src/features/affinity.js';
import { buildSystemPrompt } from '../src/core/actions.js';
import { getPersonality } from '../src/personalities/index.js';
import { getUserExportData, deleteUserData } from '../src/core/export.js';
import { EMOJI_REGEX } from '../src/core/kaomoji.js';
import coreFeature from '../src/features/core.js';

describe('Universal, Persona-Aware Affinity Shortcut (Codex Prompt)', () => {
  const USER_A = 771101;
  const USER_B = 771102;
  const CHAT_ID = 771101;
  const GROUP_CHAT_ID = -100771101;
  const TZ = 'Asia/Jakarta';

  function cleanup() {
    const db = getDb();
    const uids = [USER_A, USER_B];
    const placeholders = uids.map(() => '?').join(',');
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...uids);
    db.prepare(`DELETE FROM affinity WHERE user_id IN (${placeholders})`).run(...uids);
    try {
      db.prepare(`DELETE FROM persona_affinity WHERE user_id IN (${placeholders})`).run(...uids);
    } catch {}
  }

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. setAffinityLevel Service Function', () => {
    it('sets target points correctly for levels 0 through 4', () => {
      const now = Date.now();
      const testCases = [
        { lvl: 0, points: 0 },
        { lvl: 1, points: 35 },
        { lvl: 2, points: 75 },
        { lvl: 3, points: 150 },
        { lvl: 4, points: 250 },
      ];

      for (const { lvl, points } of testCases) {
        const aff = setAffinityLevel(USER_A, 'jiang_cheng', lvl, TZ, now);
        assert.equal(aff.level, lvl);
        assert.equal(aff.points, points);

        // Verify direct database read
        const dbAff = getAffinity(USER_A, TZ, now, 'jiang_cheng');
        assert.equal(dbAff.level, lvl);
        assert.equal(dbAff.points, points);
      }
    });

    it('supports min and max string aliases', () => {
      const now = Date.now();
      const affMin = setAffinityLevel(USER_A, 'jiang_cheng', 'min', TZ, now);
      assert.equal(affMin.level, 0);
      assert.equal(affMin.points, 0);

      const affMax = setAffinityLevel(USER_A, 'jiang_cheng', 'max', TZ, now);
      assert.equal(affMax.level, 4);
      assert.equal(affMax.points, 250);
    });

    it('preserves gainedToday and lastGainDate without resetting daily cap', () => {
      const now = Date.now();
      // Gain 6 natural points first (3 interactions)
      recordInteraction(USER_A, TZ, now, 'tsundere');
      recordInteraction(USER_A, TZ, now, 'tsundere');
      recordInteraction(USER_A, TZ, now, 'tsundere');

      const before = getAffinity(USER_A, TZ, now, 'tsundere');
      assert.equal(before.gainedToday, 6);

      // Now set level manually to 3
      const after = setAffinityLevel(USER_A, 'tsundere', 3, TZ, now);
      assert.equal(after.level, 3);
      assert.equal(after.points, 150);
      assert.equal(after.gainedToday, 6, 'gainedToday must be preserved');

      // Subsequent interaction on same day should only add up to remaining cap (15 - 6 = 9)
      const inter = recordInteraction(USER_A, TZ, now, 'tsundere');
      assert.equal(inter.gainedToday, 8);
      assert.equal(inter.points, 152);
    });

    it('rejects invalid inputs with error and does not mutate database', () => {
      const invalidLevels = [-1, 5, 2.5, 'foo', null, undefined, {}];
      for (const inv of invalidLevels) {
        assert.throws(
          () => setAffinityLevel(USER_A, 'jiang_cheng', inv, TZ),
          /Invalid affinity level/,
        );
      }
      const aff = getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng');
      assert.equal(aff.points, 0);
      assert.equal(aff.level, 0);
    });
  });

  describe('2. /setaffinity Command Handling', () => {
    it('is a public command and NOT adminOnly', () => {
      const cmd = affinityFeature.commands.find((c) => c.name === 'setaffinity');
      assert.ok(cmd, '/setaffinity command must be registered');
      assert.equal(cmd.adminOnly, undefined, 'Must not be adminOnly');
    });

    it('/setaffinity without arguments displays the interactive picker menu', async () => {
      const cmd = affinityFeature.commands.find((c) => c.name === 'setaffinity');
      const replies = [];
      const ctx = {
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: USER_A },
        message: { text: '/setaffinity' },
        persona: getPersonality('jiang_cheng'),
        reply: async (text, opts) => replies.push({ text, opts }),
      };

      await cmd.handler(ctx);
      assert.equal(replies.length, 1);
      assert.ok(replies[0].text.includes('Set Relationship Affinity Level'));
      assert.ok(replies[0].text.includes('Active personality: *Jiang Cheng*'));
      assert.ok(replies[0].opts?.reply_markup);

      const buttons = replies[0].opts.reply_markup.inline_keyboard.flat();
      assert.equal(buttons.length, 5);
      assert.ok(buttons[0].text.includes('[0] Stranger'));
      assert.ok(buttons[4].text.includes('[4] Deep Trust'));
      assert.equal(buttons[0].callback_data, `aff:set:${USER_A}:jiang_cheng:0`);
    });

    it('/setaffinity with valid level sets level and replies with confirmation', async () => {
      const cmd = affinityFeature.commands.find((c) => c.name === 'setaffinity');
      const replies = [];
      const ctx = {
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: USER_A },
        message: { text: '/setaffinity 4' },
        persona: getPersonality('jiang_cheng'),
        reply: async (text, opts) => replies.push({ text, opts }),
      };

      await cmd.handler(ctx);
      assert.equal(replies.length, 1);
      assert.ok(replies[0].text.includes('Level 4 — "Deep Trust"'));
      assert.ok(replies[0].text.includes('250 points'));

      // Verify database
      const aff = getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng');
      assert.equal(aff.level, 4);
      assert.equal(aff.points, 250);
    });

    it('/setaffinity min and max aliases work', async () => {
      const cmd = affinityFeature.commands.find((c) => c.name === 'setaffinity');
      const replies = [];
      const ctx = {
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: USER_A },
        message: { text: '/setaffinity max' },
        persona: getPersonality('tsundere'),
        reply: async (text, opts) => replies.push({ text, opts }),
      };

      await cmd.handler(ctx);
      assert.ok(replies[0].text.includes('Level 4'));
      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'tsundere').points, 250);

      ctx.message.text = '/setaffinity min';
      await cmd.handler(ctx);
      assert.ok(replies[1].text.includes('Level 0'));
      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'tsundere').points, 0);
    });

    it('/setaffinity with invalid input shows friendly usage without mutating DB', async () => {
      const cmd = affinityFeature.commands.find((c) => c.name === 'setaffinity');
      const invalidInputs = ['/setaffinity 9', '/setaffinity -1', '/setaffinity 2 3', '/setaffinity high'];

      for (const text of invalidInputs) {
        const replies = [];
        const ctx = {
          chat: { id: CHAT_ID, type: 'private' },
          from: { id: USER_A },
          message: { text },
          persona: getPersonality('jiang_cheng'),
          reply: async (t) => replies.push(t),
        };

        await cmd.handler(ctx);
        assert.ok(replies[0].includes('Invalid affinity level'));
        assert.ok(replies[0].includes('Usage:'));
      }

      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng').points, 0);
    });

    it('works in group chats for non-admin without changing other members', async () => {
      const cmd = affinityFeature.commands.find((c) => c.name === 'setaffinity');
      const replies = [];
      const ctx = {
        chat: { id: GROUP_CHAT_ID, type: 'supergroup' },
        from: { id: USER_A },
        message: { text: '/setaffinity 2' },
        persona: getPersonality('jiang_cheng'),
        reply: async (text) => replies.push(text),
      };

      await cmd.handler(ctx);
      assert.ok(replies[0].includes('Level 2'));

      // User A changed
      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng').level, 2);
      // User B untouched
      assert.equal(getAffinity(USER_B, TZ, Date.now(), 'jiang_cheng').level, 0);
    });
  });

  describe('3. Inline Button Callbacks & Security', () => {
    it('aff:set updates level when clicked by menu owner', async () => {
      const cb = affinityFeature.callbacks.find((c) => c.prefix === 'aff:set:');
      assert.ok(cb);

      let answeredAlert = null;
      let editedText = null;
      const ctx = {
        from: { id: USER_A },
        callbackQuery: { data: `aff:set:${USER_A}:jiang_cheng:3` },
        persona: getPersonality('jiang_cheng'),
        answerCallbackQuery: async (opts) => {
          answeredAlert = opts;
        },
        editMessageText: async (text) => {
          editedText = text;
        },
      };

      await cb.handler(ctx);
      assert.ok(answeredAlert.text.includes('Level 3'));
      assert.ok(editedText.includes('Level 3'));
      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng').level, 3);
    });

    it('aff:set rejects forged callback from a different user', async () => {
      const cb = affinityFeature.callbacks.find((c) => c.prefix === 'aff:set:');
      let answeredAlert = null;
      let editedText = null;

      // User B clicks button belonging to User A
      const ctx = {
        from: { id: USER_B },
        callbackQuery: { data: `aff:set:${USER_A}:jiang_cheng:4` },
        persona: getPersonality('jiang_cheng'),
        answerCallbackQuery: async (opts) => {
          answeredAlert = opts;
        },
        editMessageText: async (text) => {
          editedText = text;
        },
      };

      await cb.handler(ctx);
      assert.equal(answeredAlert.show_alert, true);
      assert.ok(answeredAlert.text.includes('cannot change affinity for another user'));
      assert.equal(editedText, null);
      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng').level, 0);
    });

    it('aff:set rejects stale callback when active persona has changed', async () => {
      const cb = affinityFeature.callbacks.find((c) => c.prefix === 'aff:set:');
      let answeredAlert = null;

      // Callback encoded for jiang_cheng, but active persona is now tsundere
      const ctx = {
        from: { id: USER_A },
        callbackQuery: { data: `aff:set:${USER_A}:jiang_cheng:4` },
        persona: getPersonality('tsundere'),
        answerCallbackQuery: async (opts) => {
          answeredAlert = opts;
        },
        editMessageText: async () => {},
      };

      await cb.handler(ctx);
      assert.equal(answeredAlert.show_alert, true);
      assert.ok(answeredAlert.text.includes('Active personality has changed'));
      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng').level, 0);
    });

    it('aff:menu callback opens picker for owner and rejects other users', async () => {
      const cb = affinityFeature.callbacks.find((c) => c.prefix === 'aff:menu:');
      assert.ok(cb);

      // Non-owner rejected
      let nonOwnerAlert = null;
      await cb.handler({
        from: { id: USER_B },
        callbackQuery: { data: `aff:menu:${USER_A}:tsundere` },
        persona: getPersonality('tsundere'),
        answerCallbackQuery: async (opts) => {
          nonOwnerAlert = opts;
        },
      });
      assert.equal(nonOwnerAlert.show_alert, true);

      // Owner accepted
      let openedText = null;
      await cb.handler({
        from: { id: USER_A },
        callbackQuery: { data: `aff:menu:${USER_A}:tsundere` },
        persona: getPersonality('tsundere'),
        answerCallbackQuery: async () => {},
        editMessageText: async (text) => {
          openedText = text;
        },
      });
      assert.ok(openedText.includes('Set Relationship Affinity Level'));
    });
  });

  describe('4. Multi-Persona & Multi-User Isolation', () => {
    it('switching between Jiang Cheng and Raka maintains completely isolated levels', () => {
      const now = Date.now();
      // User A sets Jiang Cheng to level 4
      setAffinityLevel(USER_A, 'jiang_cheng', 4, TZ, now);
      // User A sets Raka (tsundere) to level 1
      setAffinityLevel(USER_A, 'tsundere', 1, TZ, now);

      assert.equal(getAffinity(USER_A, TZ, now, 'jiang_cheng').level, 4);
      assert.equal(getAffinity(USER_A, TZ, now, 'jiang_cheng').points, 250);

      assert.equal(getAffinity(USER_A, TZ, now, 'tsundere').level, 1);
      assert.equal(getAffinity(USER_A, TZ, now, 'tsundere').points, 35);

      // User B remains at Level 0 for both
      assert.equal(getAffinity(USER_B, TZ, now, 'jiang_cheng').level, 0);
      assert.equal(getAffinity(USER_B, TZ, now, 'tsundere').level, 0);
    });
  });

  describe('5. Jiang Cheng Characterization & Safety at Level 4', () => {
    it('Level 4 retains authentic protective non-romantic tone in buildSystemPrompt', () => {
      setAffinityLevel(USER_A, 'jiang_cheng', 4, TZ, Date.now());
      const jc = getPersonality('jiang_cheng');

      const ctx = {
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: USER_A, first_name: 'Lan' },
      };

      const prompt = buildSystemPrompt({ persona: jc, ctx });
      assert.ok(prompt.includes('Level 4 - "Deep Trust" (250 points)'));
      assert.ok(prompt.includes('NEVER turns sweet, submissive, or romantic'));
      assert.ok(prompt.includes('Expresses care through practical actions and simple words of gratitude'));
    });

    it('/status card for Jiang Cheng displays proper titles and English quote', () => {
      const aff = setAffinityLevel(USER_A, 'jiang_cheng', 4, TZ, Date.now());
      const jc = getPersonality('jiang_cheng');
      const card = renderStatusCard(aff, jc);

      assert.ok(card.includes('• Level: *4* — *"Deep Trust"*'));
      assert.ok(card.includes('• Total Points: *250* points'));
      assert.ok(card.includes('The trust I give is not easily granted. Do not waste it.'));
      assert.ok(card.includes('_Use /setaffinity to change your affinity level._'));
    });
  });

  describe('6. Zero Unicode Emoji & Integrity', () => {
    it('picker text, button labels, and status cards contain zero unicode emojis', () => {
      const personas = ['tsundere', 'manis', 'ceria', 'sarkas', 'jiang_cheng'];

      for (const pId of personas) {
        const persona = getPersonality(pId);
        const aff = getAffinity(USER_A, TZ, Date.now(), pId);

        const card = renderStatusCard(aff, persona);
        assert.ok(!EMOJI_REGEX.test(card), `${pId} status card contains emoji`);

        const pickerText = renderAffinityPickerText(persona, aff);
        assert.ok(!EMOJI_REGEX.test(pickerText), `${pId} picker text contains emoji`);

        const keyboard = renderAffinityPicker(USER_A, persona, aff.level);
        const btnTexts = keyboard.inline_keyboard.flat().map((b) => b.text);
        for (const btn of btnTexts) {
          assert.ok(!EMOJI_REGEX.test(btn), `${pId} button label contains emoji: ${btn}`);
        }
      }
    });
  });

  describe('7. Export & Deleteme Privacy Integration', () => {
    it('getUserExportData exports persona_affinity and deleteUserData removes it completely', () => {
      setAffinityLevel(USER_A, 'jiang_cheng', 3, TZ, Date.now());
      setAffinityLevel(USER_A, 'tsundere', 2, TZ, Date.now());

      const data = getUserExportData(USER_A);
      assert.ok(Array.isArray(data.persona_affinity));
      assert.equal(data.persona_affinity.length, 2);

      const jcRow = data.persona_affinity.find((r) => r.persona_id === 'jiang_cheng');
      assert.ok(jcRow);
      assert.equal(jcRow.level, 3);
      assert.equal(jcRow.points, 150);

      // Now delete user data
      deleteUserData(USER_A);
      const afterExport = getUserExportData(USER_A);
      assert.equal(afterExport.persona_affinity.length, 0);
      assert.equal(getAffinity(USER_A, TZ, Date.now(), 'jiang_cheng').points, 0);
    });
  });

  describe('8. Migration 024 Idempotence & Backfill', () => {
    it('backfills legacy affinity table into persona_affinity for saved user persona', () => {
      const db = getDb();
      const TEST_MIG_USER = 772299;

      db.prepare(
        `INSERT INTO users (id, first_name, persona, created_at)
         VALUES (?, 'MigUser', 'manis', ?)`,
      ).run(TEST_MIG_USER, Date.now());

      db.prepare(
        `INSERT INTO affinity (user_id, points, level, last_gain_date, gained_today, last_chat_at)
         VALUES (?, 85, 2, '2026-11-04', 4, ?)`,
      ).run(TEST_MIG_USER, Date.now());

      // Run backfill SQL statement from migration 024
      db.prepare(`
        INSERT OR IGNORE INTO persona_affinity (user_id, persona_id, points, level, last_gain_date, gained_today, last_chat_at)
        SELECT
          a.user_id,
          COALESCE(u.persona, 'tsundere') AS persona_id,
          a.points,
          a.level,
          a.last_gain_date,
          a.gained_today,
          a.last_chat_at
        FROM affinity a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.user_id = ?
      `).run(TEST_MIG_USER);

      const aff = getAffinity(TEST_MIG_USER, TZ, Date.now(), 'manis');
      assert.equal(aff.points, 85);
      assert.equal(aff.level, 2);

      // Cleanup
      db.prepare('DELETE FROM users WHERE id = ?').run(TEST_MIG_USER);
      db.prepare('DELETE FROM affinity WHERE user_id = ?').run(TEST_MIG_USER);
      db.prepare('DELETE FROM persona_affinity WHERE user_id = ?').run(TEST_MIG_USER);
    });
  });
});

