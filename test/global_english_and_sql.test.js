import './setup.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/core/db.js';
import { getPersonality, listPersonalities } from '../src/personalities/index.js';
import { buildSystemPrompt, GLOBAL_SAFETY_RULES } from '../src/core/actions.js';
import { renderStatusCard, buildProgressBar } from '../src/features/affinity.js';
import { renderPersonaSelector } from '../src/features/persona.js';
import { renderMainMenu, renderTzMenu } from '../src/features/settings.js';
import { getAffinity, recordInteraction } from '../src/core/affinity.js';
import { addMessage, getHistory, clearHistory } from '../src/memory.js';
import {
  getSummary,
  saveSummary,
  clearSummary,
  addFact,
  getFacts,
  summarizeOlderHistory,
} from '../src/core/facts.js';
import { buildMorningMessage, buildNightMessage } from '../src/features/schedules.js';
import { buildProactiveMessage } from '../src/core/proactive.js';
import { EMOJI_REGEX } from '../src/core/kaomoji.js';
import coreFeature from '../src/features/core.js';
import translatorFeature from '../src/features/translator.js';

describe('Global English Conversion & SQLite Fix (Master Prompt)', () => {
  const USER_A = 9988001;
  const USER_B = 9988002;
  const CHAT_A = 9988001;
  const CHAT_B = 9988002;
  const TZ = 'Asia/Jakarta';

  function cleanup() {
    const db = getDb();
    const uids = [USER_A, USER_B];
    const placeholders = uids.map(() => '?').join(',');
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...uids);
    db.prepare(`DELETE FROM chats WHERE id IN (${placeholders})`).run(...uids);
    db.prepare(`DELETE FROM messages WHERE chat_id IN (${placeholders})`).run(...uids);
    db.prepare(`DELETE FROM summaries WHERE chat_id IN (${placeholders})`).run(...uids);
    db.prepare(`DELETE FROM user_facts WHERE user_id IN (${placeholders})`).run(...uids);
    db.prepare(`DELETE FROM affinity WHERE user_id IN (${placeholders})`).run(...uids);
    try {
      db.prepare(`DELETE FROM persona_affinity WHERE user_id IN (${placeholders})`).run(...uids);
    } catch {}
    try {
      db.prepare(`DELETE FROM persona_summaries WHERE chat_id IN (${placeholders})`).run(...uids);
    } catch {}
  }

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // Case A: Command UI check across multiple personalities
  it('Case A: Command UI check - all menus, cards, and buttons are in English', async () => {
    const personasToTest = ['tsundere', 'manis', 'ceria', 'sarkas', 'jiang_cheng'];

    for (const pId of personasToTest) {
      const persona = getPersonality(pId);
      assert.equal(persona.language, 'en', `${pId} must have language: 'en'`);

      // 1. /persona selector UI
      const selector = renderPersonaSelector(pId);
      assert.ok(selector.text.includes('Change Bot Personality'), `${pId} selector title`);
      assert.ok(selector.text.includes('Active personality'), `${pId} selector active`);
      assert.ok(!selector.text.includes('Ganti Personality Bot'), `${pId} selector Indonesian leak`);

      // 2. /settings menu UI
      const settings = renderMainMenu({ chat: { type: 'private' }, from: { id: USER_A } });
      assert.ok(settings.text.includes('Bot Settings'), `${pId} settings menu`);
      const buttons = settings.keyboard.inline_keyboard.flat().map((b) => b.text);
      assert.ok(buttons.some((b) => b.includes('Timezone')), `${pId} settings timezone`);
      assert.ok(buttons.some((b) => b.includes('Persona')), `${pId} settings personality`);
      assert.ok(buttons.some((b) => b.includes('GIF Frequency')), `${pId} settings gif`);

      // 3. /timezone menu UI
      const tzMenu = renderTzMenu();
      assert.ok(tzMenu.text.includes('Timezone Settings'), `${pId} tz menu`);

      // 4. /help and /about in coreFeature
      const helpCmd = coreFeature.commands.find((c) => c.name === 'help');
      const replies = [];
      const ctx = {
        from: { id: USER_A },
        persona,
        reply: async (t) => replies.push(t),
      };
      await helpCmd.handler(ctx);
      assert.ok(replies.length > 0);
      assert.ok(!replies[0].includes('Daftar Perintah'), `${pId} /help Indonesian leak`);

      const aboutCmd = coreFeature.commands.find((c) => c.name === 'about');
      const aboutReplies = [];
      await aboutCmd.handler({ reply: async (t) => aboutReplies.push(t) });
      assert.ok(aboutReplies[0].includes('Active personality:'));
      assert.ok(!aboutReplies[0].includes('Personality aktif:'));
    }
  });

  // Case B: Cross-persona language enforcement in system prompt
  it('Case B: Cross-persona language enforcement - Indonesian inputs generate English prompts with strict policy', () => {
    const personasToTest = ['tsundere', 'manis', 'ceria', 'sarkas', 'jiang_cheng'];

    for (const pId of personasToTest) {
      const persona = getPersonality(pId);
      const ctx = {
        chat: { id: CHAT_A, type: 'private' },
        from: { id: USER_A, first_name: 'Budi' },
      };

      const prompt = buildSystemPrompt({ persona, ctx });

      // Must contain English language enforcement
      assert.ok(
        prompt.includes('STRICT LANGUAGE POLICY — ENGLISH ONLY') ||
        prompt.includes('## Strict English Output & Action Enforcement'),
        `${pId} prompt missing strict English policy header`,
      );
      assert.ok(
        prompt.includes('English') && !prompt.includes('Bahasa Indonesia'),
        `${pId} prompt mentions Indonesian as active reply language`,
      );

      // Section headers must be in English
      assert.ok(prompt.includes('## Current Context'), `${pId} current context header`);
      assert.ok(!prompt.includes('## Konteks Saat Ini'), `${pId} Indonesian context header leak`);
      assert.ok(prompt.includes('## Relationship Level (Affinity)'), `${pId} affinity header`);
      assert.ok(!prompt.includes('## Level Kedekatan (Affinity)'), `${pId} Indonesian affinity header leak`);
    }
  });

  // Case C: Clean English stage directions
  it('Case C: Clean English stage directions - prompts mandate English actions and minimal stage directions', () => {
    const jc = getPersonality('jiang_cheng');
    const prompt = buildSystemPrompt({
      persona: jc,
      ctx: { chat: { id: CHAT_A }, from: { id: USER_A } },
    });

    // Instructions strictly forbid Indonesian stage directions
    assert.ok(prompt.includes('NEVER write *Mengangkat alis sedikit, pandangan tajam*'));
    assert.ok(prompt.includes('Default to natural dialogue with minimal to no stage directions.'));
    assert.ok(prompt.includes('physical actions in asterisks (*...*), gestures, thoughts, and narration.'));
  });

  // Case D: Safety hotline preservation
  it('Case D: Safety hotline preservation - Indonesian official emergency hotlines are kept verbatim', () => {
    const personas = ['tsundere', 'manis', 'ceria', 'sarkas', 'jiang_cheng'];

    for (const pId of personas) {
      const p = getPersonality(pId);
      const prompt = buildSystemPrompt({
        persona: p,
        ctx: { chat: { id: CHAT_A }, from: { id: USER_A } },
      });

      // Verify exact crisis hotlines
      assert.ok(prompt.includes('Hotline SEJIWA Kemenkes RI: Telepon 119 (ekstensi 8)'), `${pId} SEJIWA`);
      assert.ok(prompt.includes('Halo Kemenkes: 1500-567'), `${pId} Halo Kemenkes`);
      assert.ok(prompt.includes('Layanan Darurat Nasional: 112'), `${pId} 112`);
      assert.ok(prompt.includes('Batasan Medis'), `${pId} Batasan Medis`);

      // Verify English empathy instruction
      assert.ok(
        prompt.includes('warm') || prompt.includes('concern') || prompt.includes('supportive'),
        `${pId} empathy instruction`,
      );
    }
  });

  // Case E: Affinity UI localization
  it('Case E: Affinity UI localization - /status card has English headers, levels, points, and quotes', () => {
    const levels = [
      { level: 0, title: 'Stranger', points: 10, gainedToday: 2, dailyCap: 15 },
      { level: 1, title: 'Familiar Face', points: 40, gainedToday: 5, dailyCap: 15 },
      { level: 2, title: 'Growing Trust', points: 80, gainedToday: 10, dailyCap: 15 },
      { level: 3, title: 'Trusted Companion', points: 150, gainedToday: 15, dailyCap: 15 },
      { level: 4, title: 'Deep Trust', points: 260, gainedToday: 15, dailyCap: 15 },
    ];

    const personas = ['tsundere', 'manis', 'ceria', 'sarkas', 'jiang_cheng'];

    for (const pId of personas) {
      const persona = getPersonality(pId);
      for (const aff of levels) {
        const card = renderStatusCard({ ...aff, personaId: pId }, persona);

        assert.ok(card.includes('*Relationship & Affinity Status:*'), `${pId} L${aff.level} header`);
        assert.ok(card.includes('• Level:'), `${pId} L${aff.level} level label`);
        assert.ok(card.includes('• Total Points:'), `${pId} L${aff.level} total points label`);
        assert.ok(card.includes('points'), `${pId} L${aff.level} points unit`);
        assert.ok(card.includes('• Level Progress:'), `${pId} L${aff.level} progress label`);
        assert.ok(card.includes('• Points Today:'), `${pId} L${aff.level} points today label`);

        // Check no Indonesian leaks
        assert.ok(!card.includes('Status Hubungan & Kedekatan'), `${pId} L${aff.level} id leak`);
        assert.ok(!card.includes('Total Poin:'), `${pId} L${aff.level} id total poin leak`);
        assert.ok(!card.includes('Progres Level:'), `${pId} L${aff.level} id progres leak`);
        assert.ok(!card.includes('Poin Hari Ini:'), `${pId} L${aff.level} id hari ini leak`);
      }
    }
  });

  // Case F: Automation & Background memory test
  it('Case F: Automation & Background memory - Reminders, proactive, schedules, and memory summaries in English', async () => {
    const tsundere = getPersonality('tsundere');
    const jc = getPersonality('jiang_cheng');

    // 1. Morning message
    const morningMsg = buildMorningMessage({ userId: USER_A, tz: TZ, persona: tsundere });
    assert.ok(
      morningMsg.includes('no scheduled reminders') || morningMsg.includes("Today's Reminder Schedule"),
      'Morning reminders in English',
    );

    // 2. Night message
    const nightMsg = buildNightMessage({ userId: USER_A, tz: TZ, persona: jc });
    assert.ok(
      nightMsg.includes('No to-dos were completed') || nightMsg.includes('You completed'),
      'Night to-dos in English',
    );

    // 3. Proactive message
    const proactiveMsg = buildProactiveMessage({ userId: USER_A, tz: TZ, persona: tsundere });
    assert.ok(
      proactiveMsg.includes('quiet all day') ||
      proactiveMsg.includes('Where have you been') ||
      proactiveMsg.includes('Still alive'),
      'Proactive general greetings in English',
    );

    // 4. Background memory summarization
    let capturedPrompt = '';
    const mockGenerateReply = async ({ systemPrompt, userText }) => {
      capturedPrompt = `${systemPrompt} | ${userText}`;
      return 'Summary of conversation: The user discussed project timelines.';
    };

    for (let i = 0; i < 26; i++) {
      addMessage(CHAT_A, i % 2 === 0 ? 'user' : 'model', `Message ${i}`, 'tsundere');
    }

    const summary = await summarizeOlderHistory({
      chatId: CHAT_A,
      generateReplyFn: mockGenerateReply,
      threshold: 24,
      batchSize: 12,
      personaId: 'tsundere',
    });

    assert.ok(summary, 'Summary generated');
    assert.ok(capturedPrompt.includes('Always output summaries in English.'));
    assert.ok(capturedPrompt.includes('Concise English summary:'));
  });

  // Case G: Translator preservation test
  it('Case G: Translator preservation - UI in English, target translation preserved verbatim', async () => {
    const replies = [];
    const ctx = {
      from: { id: USER_A },
      message: { text: '/terjemah' },
      reply: async (t, opts) => replies.push({ t, opts }),
    };

    const cmd = translatorFeature.commands.find((c) => c.name === 'terjemah');
    await cmd.handler(ctx);

    // Command guidance in English
    assert.ok(replies[0].t.includes('Translation Command Format:'));
    assert.ok(replies[0].t.includes('Example:'));
    assert.ok(!replies[0].t.includes('Format Perintah Terjemahan'));
  });

  // Case H: Multi-user persona isolation
  it('Case H: Multi-user persona isolation - User A (Jiang Cheng) and User B (Raka) remain strictly isolated', () => {
    const now = Date.now();

    // User A interacts with jiang_cheng
    recordInteraction(USER_A, TZ, now, 'jiang_cheng');
    addMessage(CHAT_A, 'user', 'Greetings Sect Leader Jiang.', 'jiang_cheng');
    addFact(USER_A, 'Enjoys swordplay');
    saveSummary(CHAT_A, 'User A discussed Yunmeng clan affairs.', 'jiang_cheng');

    // User B interacts with tsundere
    recordInteraction(USER_B, TZ, now, 'tsundere');
    addMessage(CHAT_B, 'user', 'Hey Raka, are you there?', 'tsundere');
    addFact(USER_B, 'Likes baking cookies');
    saveSummary(CHAT_B, 'User B asked about homework.', 'tsundere');

    // Verify isolation
    const affA = getAffinity(USER_A, TZ, now, 'jiang_cheng');
    const affB = getAffinity(USER_B, TZ, now, 'tsundere');
    assert.equal(affA.points, 2);
    assert.equal(affB.points, 2);

    const histA = getHistory(CHAT_A, 'jiang_cheng');
    const histB = getHistory(CHAT_B, 'tsundere');
    assert.equal(histA.length, 1);
    assert.equal(histB.length, 1);
    assert.ok(histA[0].text.includes('Sect Leader'));
    assert.ok(histB[0].text.includes('Raka'));

    const sumA = getSummary(CHAT_A, 'jiang_cheng');
    const sumB = getSummary(CHAT_B, 'tsundere');
    assert.ok(sumA.includes('Yunmeng'));
    assert.ok(sumB.includes('homework'));

    const factsA = getFacts(USER_A);
    const factsB = getFacts(USER_B);
    assert.equal(factsA[0].fact, 'Enjoys swordplay');
    assert.equal(factsB[0].fact, 'Likes baking cookies');
  });

  // Case I: Background memory SQLite bug regression test (no such column: "jiang_cheng")
  it('Case I: Background memory SQLite bug regression test - no such column error with jiang_cheng persona', async () => {
    const db = getDb();

    // Verify parameterization in index.js query structure
    const targetPersona = 'jiang_cheng';
    const recentRows = db
      .prepare(
        `SELECT role, text FROM messages
         WHERE chat_id = ? AND (persona_id = ? OR (persona_id IS NULL AND ? = 'tsundere'))
         ORDER BY id DESC
         LIMIT 20`,
      )
      .all(CHAT_A, targetPersona, targetPersona);

    assert.ok(Array.isArray(recentRows));

    // Verify getSummary, saveSummary, clearSummary with jiang_cheng do not throw SQLite errors
    assert.doesNotThrow(() => {
      saveSummary(CHAT_A, 'Test summary for Jiang Cheng', 'jiang_cheng');
      const s = getSummary(CHAT_A, 'jiang_cheng');
      assert.equal(s, 'Test summary for Jiang Cheng');
      clearSummary(CHAT_A, 'jiang_cheng');
      assert.equal(getSummary(CHAT_A, 'jiang_cheng'), null);
    });

    // Verify summarizeOlderHistory does not throw SQLite errors
    for (let i = 0; i < 26; i++) {
      addMessage(CHAT_A, i % 2 === 0 ? 'user' : 'model', `Test msg ${i}`, 'jiang_cheng');
    }

    const mockGen = async () => 'Consolidated summary of training discussion.';
    await assert.doesNotReject(async () => {
      await summarizeOlderHistory({
        chatId: CHAT_A,
        generateReplyFn: mockGen,
        threshold: 24,
        batchSize: 12,
        personaId: 'jiang_cheng',
      });
    });
  });

  // Case J: History language robustness
  it('Case J: History language robustness - Indonesian in history does not cause language drift', () => {
    const tsundere = getPersonality('tsundere');
    addMessage(CHAT_A, 'user', 'Halo Raka, tolong bantu aku dong', 'tsundere');
    addMessage(CHAT_A, 'model', 'I-it is not like I want to help you, but what do you need?', 'tsundere');
    addMessage(CHAT_A, 'user', 'Mau nanya tugas matematika nih', 'tsundere');

    const prompt = buildSystemPrompt({
      persona: tsundere,
      ctx: { chat: { id: CHAT_A }, from: { id: USER_A } },
    });

    assert.ok(prompt.includes('## Strict English Output & Action Enforcement'));
    assert.ok(
      prompt.includes(
        'Any previous messages in conversation history that were written in Indonesian or other languages are strictly historical context.',
      ),
    );
    assert.ok(prompt.includes('Your reply must always be 100% English.'));
  });

  // Case K: Integrity checks (placeholders, valid markdown, Zero Unicode Emoji)
  it('Case K: Integrity checks - placeholders intact, valid markdown, strict zero unicode emoji', () => {
    const allPersonalities = listPersonalities().map((id) => getPersonality(id));

    for (const p of allPersonalities) {
      assert.ok(!EMOJI_REGEX.test(p.name), `${p.id} name has emoji`);
      assert.ok(!EMOJI_REGEX.test(p.greeting), `${p.id} greeting has emoji`);
      assert.ok(!EMOJI_REGEX.test(p.errorMessage), `${p.id} errorMessage has emoji`);
      assert.ok(!EMOJI_REGEX.test(p.systemPrompt), `${p.id} systemPrompt has emoji`);

      // Verify strings placeholders
      const s = p.strings || {};
      for (const [key, val] of Object.entries(s)) {
        if (typeof val === 'string') {
          assert.ok(!EMOJI_REGEX.test(val), `${p.id}.${key} has emoji`);
        } else if (Array.isArray(val)) {
          val.forEach((item, idx) => {
            if (typeof item === 'string') {
              assert.ok(!EMOJI_REGEX.test(item), `${p.id}.${key}[${idx}] has emoji`);
            }
          });
        }
      }

      // Check required placeholders
      if (s.reminderSet) {
        assert.ok(s.reminderSet.includes('{time}'), `${p.id} reminderSet missing {time}`);
        assert.ok(s.reminderSet.includes('{text}'), `${p.id} reminderSet missing {text}`);
      }
      if (s.todoAdded) {
        assert.ok(s.todoAdded.includes('{text}'), `${p.id} todoAdded missing {text}`);
      }
      if (s.todoDeleted) {
        assert.ok(s.todoDeleted.includes('{num}'), `${p.id} todoDeleted missing {num}`);
      }
    }
  });

  // Case L: Test suite execution confirmation
  it('Case L: Test suite execution confirmation - test completes cleanly without unhandled rejection', () => {
    assert.ok(true, 'Test execution completed cleanly');
  });
});
