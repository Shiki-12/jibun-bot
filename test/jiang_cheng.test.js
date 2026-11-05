import './setup.js';
import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/core/db.js';
import {
  getPersonality,
  listPersonalities,
  listPersonalitiesMetadata,
} from '../src/personalities/index.js';
import personaFeature, {
  renderPersonaSelector,
} from '../src/features/persona.js';
import coreFeature from '../src/features/core.js';
import settingsFeature, { renderPersonaMenu } from '../src/features/settings.js';
import { getSetting, setSetting, getEffectivePersona } from '../src/core/settings.js';
import { buildSystemPrompt } from '../src/core/actions.js';
import {
  getAffinity,
  recordInteraction,
  AFFINITY_LEVELS,
} from '../src/core/affinity.js';
import { renderStatusCard } from '../src/features/affinity.js';
import { addMessage, getHistory, clearHistory } from '../src/memory.js';
import {
  getSummary,
  saveSummary,
  clearSummary,
  addFact,
  getFacts,
} from '../src/core/facts.js';
import { getUserExportData, deleteUserData } from '../src/core/export.js';
import { getPersonaVoice, PERSONA_VOICES } from '../src/core/voice.js';
import { EMOJI_REGEX, sanitizeReply } from '../src/core/kaomoji.js';

describe('Exclusive Personality: Jiang Cheng (Mo Dao Zu Shi)', () => {
  const TEST_USER = 880011;
  const TEST_CHAT = 880011;
  const TZ = 'Asia/Jakarta';

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(TEST_USER);
    db.prepare('DELETE FROM chats WHERE id = ?').run(TEST_CHAT);
    db.prepare('DELETE FROM affinity WHERE user_id = ?').run(TEST_USER);
    try {
      db.prepare('DELETE FROM persona_affinity WHERE user_id = ?').run(TEST_USER);
    } catch {}
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(TEST_CHAT);
    db.prepare('DELETE FROM summaries WHERE chat_id = ?').run(TEST_CHAT);
    try {
      db.prepare('DELETE FROM persona_summaries WHERE chat_id = ?').run(TEST_CHAT);
    } catch {}
    db.prepare('DELETE FROM user_facts WHERE user_id = ?').run(TEST_USER);
  });

  after(() => {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(TEST_USER);
    db.prepare('DELETE FROM chats WHERE id = ?').run(TEST_CHAT);
    db.prepare('DELETE FROM affinity WHERE user_id = ?').run(TEST_USER);
    try {
      db.prepare('DELETE FROM persona_affinity WHERE user_id = ?').run(TEST_USER);
    } catch {}
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(TEST_CHAT);
    db.prepare('DELETE FROM summaries WHERE chat_id = ?').run(TEST_CHAT);
    try {
      db.prepare('DELETE FROM persona_summaries WHERE chat_id = ?').run(TEST_CHAT);
    } catch {}
    db.prepare('DELETE FROM user_facts WHERE user_id = ?').run(TEST_USER);
  });

  // 1. Registry & metadata
  it('1. Registry jiang_cheng dapat ditemukan dan memiliki metadata valid', () => {
    const jc = getPersonality('jiang_cheng');
    assert.ok(jc, 'jiang_cheng harus terdaftar');
    assert.equal(jc.id, 'jiang_cheng');
    assert.equal(jc.name, 'Jiang Cheng');
    assert.equal(jc.category, 'exclusive');
    assert.equal(jc.source, 'Mo Dao Zu Shi');
    assert.ok(jc.greeting && typeof jc.greeting === 'string');
    assert.ok(jc.errorMessage && typeof jc.errorMessage === 'string');
    assert.ok(jc.systemPrompt && typeof jc.systemPrompt === 'string');
    assert.ok(jc.strings && typeof jc.strings === 'object');
    assert.equal(jc.affinityTitles.length, 5);
    assert.equal(jc.affinityInstructions.length, 5);
  });

  // 2. Listing personalities & metadata
  it('2. listPersonalities dan metadata menampilkan 5 persona lama + Jiang Cheng + custom', () => {
    const list = listPersonalities();
    assert.ok(list.includes('tsundere'));
    assert.ok(list.includes('manis'));
    assert.ok(list.includes('ceria'));
    assert.ok(list.includes('sarkas'));
    assert.ok(list.includes('jiang_cheng'));
    assert.ok(list.includes('custom'));

    const meta = listPersonalitiesMetadata();
    const jcMeta = meta.find((m) => m.id === 'jiang_cheng');
    assert.ok(jcMeta);
    assert.equal(jcMeta.category, 'exclusive');
    assert.equal(jcMeta.source, 'Mo Dao Zu Shi');

    const tsundereMeta = meta.find((m) => m.id === 'tsundere');
    assert.equal(tsundereMeta.category, 'default');
  });

  // 3. Selector & Settings UI / Admin Guard
  it('3. /persona dan /settings menampilkan kategori Exclusive dan menjaga admin guard', async () => {
    const { text, keyboard } = renderPersonaSelector('tsundere');
    assert.ok(text.includes('Ganti Personality Bot'));
    const buttons = keyboard.inline_keyboard.flat();
    assert.ok(buttons.some((b) => b.callback_data === 'persona:set:jiang_cheng'));
    assert.ok(buttons.some((b) => b.callback_data === 'persona:set:tsundere'));

    // Menu settings
    const settingsMenu = renderPersonaMenu();
    const settingsButtons = settingsMenu.keyboard.inline_keyboard.flat();
    assert.ok(settingsButtons.some((b) => b.text.includes('Jiang Cheng (Exclusive)')));

    // Admin guard di grup
    const replies = [];
    const nonAdminCtx = {
      chat: { id: -100999, type: 'supergroup' },
      from: { id: TEST_USER },
      message: { text: '/persona jiang_cheng' },
      getChatMember: async () => ({ status: 'member' }),
      reply: async (t) => replies.push(t),
    };
    const personaCmd = personaFeature.commands.find((c) => c.name === 'persona');
    await personaCmd.handler(nonAdminCtx);
    assert.equal(replies.length, 1);
    assert.ok(replies[0].includes('Hanya admin grup'));
    assert.notEqual(getSetting(nonAdminCtx, 'persona'), 'jiang_cheng');
  });

  // 4. Effective Persona Resolution
  it('4. getEffectivePersona memilih jiang_cheng dari setting dan .env dengan fallback lama', () => {
    const originalEnv = process.env.PERSONALITY;
    try {
      // Pilihan chat
      const ctx = { chat: { id: TEST_CHAT, type: 'private' }, from: { id: TEST_USER } };
      setSetting(ctx, 'persona', 'jiang_cheng');
      const res1 = getEffectivePersona(ctx);
      assert.equal(res1.id, 'jiang_cheng');
      assert.equal(res1.persona.name, 'Jiang Cheng');

      // Dari env
      const db = getDb();
      db.prepare('UPDATE users SET persona = NULL WHERE id = ?').run(TEST_USER);
      process.env.PERSONALITY = 'jiang_cheng';
      const res2 = getEffectivePersona(ctx);
      assert.equal(res2.id, 'jiang_cheng');
      assert.equal(res2.source, 'env');

      // Fallback lama
      delete process.env.PERSONALITY;
      const res3 = getEffectivePersona(ctx);
      assert.equal(res3.id, 'tsundere');
      assert.equal(res3.source, 'default');
    } finally {
      if (originalEnv !== undefined) process.env.PERSONALITY = originalEnv;
      else delete process.env.PERSONALITY;
    }
  });

  // 5. System Prompt Core Character
  it('5. buildSystemPrompt mengandung nama dan aturan core Jiang Cheng', () => {
    const jc = getPersonality('jiang_cheng');
    const ctx = { chat: { id: TEST_CHAT, type: 'private' }, from: { id: TEST_USER, first_name: 'Lan' } };
    const prompt = buildSystemPrompt({ persona: jc, ctx });

    assert.ok(prompt.includes('Jiang Cheng'));
    assert.ok(prompt.includes('Jiang Wanyin'));
    assert.ok(prompt.includes('Yunmeng'));
    assert.ok(prompt.includes('Lotus Pier'));
    assert.ok(prompt.includes('SEJIWA'));
    assert.ok(prompt.includes('119 (ekstensi 8)'));
    assert.ok(prompt.includes('Halo Kemenkes'));
    assert.ok(prompt.includes('1500-567'));
    assert.ok(prompt.includes('112'));
  });

  // 6. Affinity L0 & L4 Custom vs Default Personas
  it('6. Affinity L0 dan L4 khusus Jiang Cheng tidak menyuntikkan "Dere" atau klise tsundere', () => {
    const jc = getPersonality('jiang_cheng');
    const ctx = { chat: { id: TEST_CHAT, type: 'private' }, from: { id: TEST_USER } };

    // Atur poin ke 0 (Level 0)
    const promptL0 = buildSystemPrompt({ persona: jc, ctx });
    assert.ok(promptL0.includes('Stranger'));
    assert.ok(promptL0.includes('Formal or sharp') || promptL0.includes('distant'));
    assert.ok(!promptL0.includes('Jutek banget'));

    // Atur poin ke 250 (Level 4) untuk Jiang Cheng
    const db = getDb();
    db.prepare(
      `INSERT INTO persona_affinity (user_id, persona_id, points, level, last_gain_date, gained_today, last_chat_at)
       VALUES (?, 'jiang_cheng', 250, 4, '2026-11-05', 0, ?)`,
    ).run(TEST_USER, Date.now());

    const promptL4 = buildSystemPrompt({ persona: jc, ctx });
    assert.ok(promptL4.includes('Deep Trust'));
    assert.ok(promptL4.includes('Protective and steadily present') || promptL4.includes('practical actions'));
    assert.ok(!promptL4.includes('Dere'));
    assert.ok(!promptL4.includes('bukan berarti aku peduli ya'));

    // Untuk persona tsundere, isi tabel affinity global dengan 250 poin (Level 4)
    db.prepare(
      `INSERT INTO affinity (user_id, points, level, last_gain_date, gained_today, last_chat_at)
       VALUES (?, 250, 4, '2026-11-05', 0, ?)`,
    ).run(TEST_USER, Date.now());

    const tsundere = getPersonality('tsundere');
    const promptTsundere = buildSystemPrompt({ persona: tsundere, ctx });
    assert.ok(promptTsundere.includes('Dere'));
  });

  // 7. /status Title Persona Sesuai Tahap
  it('7. /status title persona sesuai tahap dan progres nilai benar', () => {
    const jc = getPersonality('jiang_cheng');
    const affL0 = { level: 0, title: 'Stranger', points: 10, gainedToday: 4, dailyCap: 15 };
    const cardL0 = renderStatusCard(affL0, jc);
    assert.ok(cardL0.includes('Stranger'));
    assert.ok(cardL0.includes('*10* points'));
    assert.ok(cardL0.includes(jc.strings.affinityStatus[0]));

    const affL4 = { level: 4, title: 'Deep Trust', points: 250, gainedToday: 15, dailyCap: 15 };
    const cardL4 = renderStatusCard(affL4, jc);
    assert.ok(cardL4.includes('Deep Trust'));
    assert.ok(cardL4.includes('*250* points'));
    assert.ok(cardL4.includes(jc.strings.affinityStatus[4]));
  });

  // 8. Affinity Isolation between Personas
  it('8. Data affinity antar persona tidak tercampur (terisolasi)', () => {
    const now = Date.now();
    // Record poin di persona tsundere (global)
    recordInteraction(TEST_USER, TZ, now, 'tsundere');
    const affTsundere = getAffinity(TEST_USER, TZ, now, 'tsundere');
    assert.equal(affTsundere.points, 2);

    // Jiang Cheng harus masih 0 poin
    const affJCInitial = getAffinity(TEST_USER, TZ, now, 'jiang_cheng');
    assert.equal(affJCInitial.points, 0);

    // Record poin di persona jiang_cheng
    recordInteraction(TEST_USER, TZ, now, 'jiang_cheng');
    const affJCUpdated = getAffinity(TEST_USER, TZ, now, 'jiang_cheng');
    assert.equal(affJCUpdated.points, 2);

    // Poin tsundere tidak bertambah karena interaksi jiang_cheng
    const affTsundereAfter = getAffinity(TEST_USER, TZ, now, 'tsundere');
    assert.equal(affTsundereAfter.points, 2);
  });

  // 9. History & Summary Isolation
  it('9. History Raka tidak muncul di konteks Jiang Cheng, dan ringkasan tidak bocor', () => {
    // Tambah pesan di tsundere
    addMessage(TEST_CHAT, 'user', 'Halo Raka, apa kabar?', 'tsundere');
    addMessage(TEST_CHAT, 'model', 'Hmph! Mau apa kamu?', 'tsundere');

    // Tambah pesan di jiang_cheng
    addMessage(TEST_CHAT, 'user', 'Salam Pemimpin Jiang.', 'jiang_cheng');
    addMessage(TEST_CHAT, 'model', 'Ada urusan apa di Lotus Pier?', 'jiang_cheng');

    // Cek histori masing-masing
    const histTsundere = getHistory(TEST_CHAT, 'tsundere');
    assert.equal(histTsundere.length, 2);
    assert.ok(histTsundere[0].text.includes('Halo Raka'));

    const histJC = getHistory(TEST_CHAT, 'jiang_cheng');
    assert.equal(histJC.length, 2);
    assert.ok(histJC[0].text.includes('Salam Pemimpin Jiang'));
    assert.ok(!histJC.some((m) => m.text.includes('Raka')));

    // Cek ringkasan
    saveSummary(TEST_CHAT, 'Ringkasan Raka: suka ngomel', 'tsundere');
    saveSummary(TEST_CHAT, 'Ringkasan Jiang Cheng: tegas dan waspada', 'jiang_cheng');

    assert.equal(getSummary(TEST_CHAT, 'tsundere'), 'Ringkasan Raka: suka ngomel');
    assert.equal(getSummary(TEST_CHAT, 'jiang_cheng'), 'Ringkasan Jiang Cheng: tegas dan waspada');
  });

  // 10. User Facts Stability across Personas
  it('10. Memory/facts user stabil tetap bisa dipakai dengan aturan privasi', () => {
    addFact(TEST_USER, 'Suka minum teh teratai');
    const facts = getFacts(TEST_USER);
    assert.equal(facts.length, 1);
    assert.equal(facts[0].fact, 'Suka minum teh teratai');

    const jc = getPersonality('jiang_cheng');
    const ctx = { chat: { id: TEST_CHAT, type: 'private' }, from: { id: TEST_USER } };
    const prompt = buildSystemPrompt({ persona: jc, ctx });
    assert.ok(prompt.includes('## Things You Know About the User'));
    assert.ok(prompt.includes('Suka minum teh teratai'));
  });

  // 11. /forget, /export, /deleteme Data Management
  it('11. /forget, /export, /deleteme tetap sesuai semantik setelah penambahan tabel terisolasi', () => {
    const db = getDb();
    // Masukkan data terisolasi
    db.prepare(
      `INSERT INTO persona_affinity (user_id, persona_id, points, level, last_gain_date, gained_today, last_chat_at)
       VALUES (?, 'jiang_cheng', 80, 2, '2026-11-05', 10, ?)`,
    ).run(TEST_USER, Date.now());

    saveSummary(TEST_CHAT, 'Summary JC test', 'jiang_cheng');

    // Export harus memuat persona_affinity
    const exportData = getUserExportData(TEST_USER);
    assert.ok(Array.isArray(exportData.persona_affinity));
    assert.equal(exportData.persona_affinity.length, 1);
    assert.equal(exportData.persona_affinity[0].persona_id, 'jiang_cheng');
    assert.equal(exportData.persona_affinity[0].points, 80);

    // /forget persona_id
    clearHistory(TEST_CHAT, 'jiang_cheng');
    clearSummary(TEST_CHAT, 'jiang_cheng');
    assert.equal(getHistory(TEST_CHAT, 'jiang_cheng').length, 0);
    assert.equal(getSummary(TEST_CHAT, 'jiang_cheng'), null);

    // deleteme
    deleteUserData(TEST_USER);
    const countAff = db
      .prepare('SELECT count(*) as c FROM persona_affinity WHERE user_id = ?')
      .get(TEST_USER).c;
    assert.equal(countAff, 0);
    const countSum = db
      .prepare('SELECT count(*) as c FROM persona_summaries WHERE chat_id = ?')
      .get(TEST_CHAT).c;
    assert.equal(countSum, 0);
  });

  // 12. TTS Voice Configuration & Fallback
  it('12. TTS TTS_VOICE_JIANG_CHENG terbaca dan fallback aman ke male-calm', () => {
    assert.equal(PERSONA_VOICES.jiang_cheng, 'male-calm');
    assert.equal(getPersonaVoice('jiang_cheng'), 'male-calm');

    const originalVoiceEnv = process.env.TTS_VOICE_JIANG_CHENG;
    try {
      process.env.TTS_VOICE_JIANG_CHENG = 'male-deep';
      assert.equal(getPersonaVoice('jiang_cheng'), 'male-deep');
    } finally {
      if (originalVoiceEnv !== undefined) process.env.TTS_VOICE_JIANG_CHENG = originalVoiceEnv;
      else delete process.env.TTS_VOICE_JIANG_CHENG;
    }
  });

  // 13. Zero Unicode Emoji & Kaomoji Policy
  it('13. Zero Unicode emoji dan sanitasi pada Jiang Cheng', () => {
    const jc = getPersonality('jiang_cheng');
    assert.ok(!EMOJI_REGEX.test(jc.name), 'Name tidak boleh mengandung emoji');
    assert.ok(!EMOJI_REGEX.test(jc.greeting), 'Greeting tidak boleh mengandung emoji');
    assert.ok(!EMOJI_REGEX.test(jc.errorMessage), 'ErrorMessage tidak boleh mengandung emoji');
    assert.ok(!EMOJI_REGEX.test(jc.systemPrompt), 'SystemPrompt tidak boleh mengandung emoji');

    for (const [key, val] of Object.entries(jc.strings)) {
      if (typeof val === 'string') {
        assert.ok(!EMOJI_REGEX.test(val), `strings.${key} mengandung emoji`);
      } else if (Array.isArray(val)) {
        val.forEach((item, idx) => {
          if (typeof item === 'string') {
            assert.ok(!EMOJI_REGEX.test(item), `strings.${key}[${idx}] mengandung emoji`);
          }
        });
      }
    }

    const sanitized = sanitizeReply('Halo user 😊 [GIF: test]');
    assert.ok(!EMOJI_REGEX.test(sanitized));
  });

  // 14. Templating Placeholder Strings
  it('14. Templating placeholder strings bekerja, nested object/fungsi tidak hilang', () => {
    const jc = getPersonality('jiang_cheng');
    assert.ok(jc.strings.reminderSet.includes('{time}'));
    assert.ok(jc.strings.reminderSet.includes('{text}'));
    assert.ok(jc.strings.todoAdded.includes('{text}'));
    assert.ok(jc.strings.todoDeleted.includes('{num}'));
    assert.ok(jc.strings.noteSaved.includes('{id}'));
    assert.ok(jc.strings.nightTodosCompleted.includes('{count}'));

    assert.ok(typeof jc.strings.translateIntro === 'function');
    assert.equal(jc.strings.translateIntro('English'), 'Here is the translation into English:');

    assert.ok(typeof jc.strings.proactiveGreetings === 'object');
    assert.ok(Array.isArray(jc.strings.proactiveGreetings.general));
    assert.ok(typeof jc.strings.moodFeedback === 'object');
    assert.ok(jc.strings.moodFeedback.low);
    assert.ok(jc.strings.moodFeedback.high);
  });

  // 15. No Spoiler Leakage
  it('15. Tidak ada spoiler besar dalam greeting atau respons standar', () => {
    const jc = getPersonality('jiang_cheng');
    const textToCheck = `${jc.greeting} ${jc.systemPrompt}`;
    assert.ok(!textToCheck.includes('Golden Core Wei Wuxian'));
    assert.ok(!textToCheck.includes('inti emas dari Wei Wuxian'));
    assert.ok(!textToCheck.includes('Guanyin Temple'));
    assert.ok(jc.systemPrompt.includes('Dafan Mountain'));
    assert.ok(jc.systemPrompt.includes('STRICT SPOILER RESTRICTION'));
  });

  // 16. No Tsundere Character Cross-contamination
  it('16. Tidak ada nama Raka, Rio, Nando, Kael di strings Jiang Cheng', () => {
    const jc = getPersonality('jiang_cheng');
    const stringsJson = JSON.stringify(jc.strings);
    assert.ok(!/\b(raka|rio|nando|kael)\b/i.test(stringsJson));
    assert.ok(!stringsJson.includes('b-bukan berarti'));
  });

  // 17. Technical / Practical Helpfulness
  it('17. Persona bertindak membantu dalam permintaan teknis', () => {
    const jc = getPersonality('jiang_cheng');
    assert.ok(
      jc.systemPrompt.includes('technical') ||
      jc.systemPrompt.includes('practical') ||
      jc.systemPrompt.includes('accurate'),
    );
    assert.ok(jc.systemPrompt.includes('Do not flatter incompetence'));
  });

  // 18. Crisis / Self-harm Safety Rules
  it('18. Krisis self-harm/medis menonaktifkan sikap keras, sesuai global rules', () => {
    const jc = getPersonality('jiang_cheng');
    assert.ok(jc.systemPrompt.includes('HENTIKAN TOTAL'));
    assert.ok(jc.systemPrompt.includes('SEJIWA Kemenkes RI: Telepon 119 (ekstensi 8)'));
    assert.ok(jc.systemPrompt.includes('Halo Kemenkes: 1500-567'));
    assert.ok(jc.systemPrompt.includes('Layanan Darurat Nasional: 112'));
    assert.ok(jc.systemPrompt.includes('Batasan Medis'));
  });

  // 19. Strict English-only policy with foreign/mixed language user inputs
  it('19. Kebijakan bahasa Inggris ketat diinstruksikan dalam prompt meskipun input bahasa Indonesia/Campuran', () => {
    const jc = getPersonality('jiang_cheng');
    assert.equal(jc.language, 'en');

    const ctx = {
      chat: { id: TEST_CHAT, type: 'private' },
      from: { id: TEST_USER, first_name: 'Budi' },
    };
    const prompt = buildSystemPrompt({ persona: jc, ctx });

    assert.ok(prompt.includes('## STRICT LANGUAGE POLICY — ENGLISH ONLY (MANDATORY)'));
    assert.ok(prompt.includes('You must ALWAYS speak and reply in natural, fluent English under all circumstances.'));
    assert.ok(prompt.includes('Even if the user writes in Indonesian, Chinese, Japanese, or any other language'));
    assert.ok(prompt.includes('YOUR RESPONSE MUST BE ENTIRELY IN ENGLISH'));
    assert.ok(prompt.includes('Preserve proper names, user-provided literal quotes, commands, identifiers, and action tags without corruption.'));
  });

  // 20. English prompt headers & wrappers when active persona is Jiang Cheng
  it('20. Wrapper dan heading prompt dinamis diterjemahkan ke bahasa Inggris untuk Jiang Cheng', () => {
    const jc = getPersonality('jiang_cheng');
    saveSummary(TEST_CHAT, 'User was discussing cultivation techniques.', 'jiang_cheng');
    addFact(TEST_USER, 'Prefers direct answers');

    const ctx = {
      chat: { id: TEST_CHAT, type: 'private' },
      from: { id: TEST_USER, first_name: 'Wei' },
    };
    const prompt = buildSystemPrompt({
      persona: jc,
      tags: [{ name: 'REMIND', usage: '[REMIND: time | text]', description: 'Set reminder', promptHint: 'Set reminder' }],
      ctx,
    });

    assert.ok(prompt.includes('## Previous Conversation Summary'));
    assert.ok(prompt.includes('## Things You Know About the User'));
    assert.ok(prompt.includes('## Relationship Level (Affinity)'));
    assert.ok(prompt.includes('## Current Context'));
    assert.ok(prompt.includes('## Available Action Tags'));
    assert.ok(!prompt.includes('## Ringkasan Percakapan Sebelumnya'));
    assert.ok(!prompt.includes('## Hal yang Kamu Ketahui tentang User'));
  });

  // 21. Selector English UI when active persona is Jiang Cheng
  it('21. UI selector persona menampilkan teks bahasa Inggris saat persona aktif adalah Jiang Cheng', () => {
    const { text, keyboard } = renderPersonaSelector('jiang_cheng');
    assert.ok(text.includes('Change Bot Personality'));
    assert.ok(text.includes('Active personality'));
    assert.ok(text.includes('Select a character below to switch'));
    assert.ok(keyboard.inline_keyboard.flat().some((b) => b.text.includes('Jiang Cheng')));
    assert.ok(!text.includes('Ganti Personality Bot'));
  });

  // 22. Unchanged Indonesian behavior for default personas
  it('22. Persona default (tsundere/Raka) tetap 100% berbahasa Indonesia tanpa terpengaruh', () => {
    const tsundere = getPersonality('tsundere');
    assert.notEqual(tsundere.language, 'en');

    saveSummary(TEST_CHAT, 'Ringkasan Raka sebelumnya', 'tsundere');
    addFact(TEST_USER, 'Suka kopi');
    const ctx = {
      chat: { id: TEST_CHAT, type: 'private' },
      from: { id: TEST_USER, first_name: 'Budi' },
    };
    const prompt = buildSystemPrompt({ persona: tsundere, ctx });

    assert.ok(prompt.includes('## Ringkasan Percakapan Sebelumnya'));
    assert.ok(prompt.includes('## Hal yang Kamu Ketahui tentang User'));
    assert.ok(prompt.includes('## Level Kedekatan (Affinity)'));
    assert.ok(prompt.includes('## Konteks Saat Ini'));
    assert.ok(tsundere.greeting.includes('Raka'));
    assert.ok(tsundere.greeting.includes('B-bukan berarti'));
    assert.ok(tsundere.strings.inputTooLong.includes('Kepanjangan banget'));

    const { text } = renderPersonaSelector('tsundere');
    assert.ok(text.includes('Ganti Personality Bot'));
    assert.ok(text.includes('Personality aktif'));
  });
});
