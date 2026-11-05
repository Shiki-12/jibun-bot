import { getDb } from './db.js';

/**
 * Kumpulkan seluruh data user yang tersimpan di bot untuk diekspor ke JSON.
 * @param {number} userId
 * @returns {object}
 */
export function getUserExportData(userId) {
  const db = getDb();

  const profile =
    db.prepare('SELECT id, first_name, username, tz, persona, lang, city, voice_reply, created_at FROM users WHERE id = ?').get(userId) ||
    { id: userId };

  const notes = db
    .prepare('SELECT id, text, tags, created_at FROM notes WHERE user_id = ? ORDER BY id ASC')
    .all(userId);

  const todos = db
    .prepare('SELECT id, text, done, due_at, created_at, done_at FROM todos WHERE user_id = ? ORDER BY id ASC')
    .all(userId);

  const reminders = db
    .prepare('SELECT id, chat_id, text, due_at, tz, repeat, status, created_at FROM reminders WHERE user_id = ? ORDER BY due_at ASC')
    .all(userId);

  const facts = db
    .prepare('SELECT id, fact, created_at FROM user_facts WHERE user_id = ? ORDER BY id ASC')
    .all(userId);

  const expenses = db
    .prepare('SELECT id, amount, category, note, created_at FROM expenses WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId);

  const moods = db
    .prepare('SELECT id, score, note, date_str, created_at FROM moods WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId);

  const habits = db
    .prepare('SELECT id, name, remind_time, created_at FROM habits WHERE user_id = ? ORDER BY id ASC')
    .all(userId);

  const habitLogs = db
    .prepare(
      `SELECT l.habit_id, l.date, l.status
       FROM habit_logs l
       JOIN habits h ON l.habit_id = h.id
       WHERE h.user_id = ?
       ORDER BY l.date ASC`,
    )
    .all(userId);

  const affinity =
    db.prepare('SELECT points, level, last_gain_date, gained_today, last_chat_at FROM affinity WHERE user_id = ?').get(userId) || null;

  let personaAffinity = [];
  try {
    personaAffinity = db
      .prepare('SELECT persona_id, points, level, last_gain_date, gained_today, last_chat_at FROM persona_affinity WHERE user_id = ?')
      .all(userId);
  } catch {}

  const gameScores = db
    .prepare('SELECT chat_id, points, wins, losses, draws, updated_at FROM game_scores WHERE user_id = ?')
    .all(userId);

  const customPersona =
    db.prepare('SELECT name, description, created_at FROM custom_personas WHERE user_id = ?').get(userId) || null;

  const proactive =
    db.prepare('SELECT enabled, quiet_start, quiet_end, unreplied_count, last_sent_at FROM proactive_settings WHERE user_id = ?').get(userId) || null;

  return {
    export_metadata: {
      exported_at: new Date().toISOString(),
      user_id: userId,
      format_version: '1.0',
    },
    user_profile: profile,
    notes,
    todos,
    reminders,
    memory_facts: facts,
    expenses,
    moods,
    habits: habits.map((h) => ({
      ...h,
      logs: habitLogs.filter((l) => l.habit_id === h.id),
    })),
    affinity,
    persona_affinity: personaAffinity,
    game_scores: gameScores,
    custom_persona: customPersona,
    proactive_settings: proactive,
  };
}

/**
 * Hapus seluruh data pribadi pengguna secara permanen dari database.
 * @param {number} userId
 * @returns {{ success: boolean, userId: number }}
 */
export function deleteUserData(userId) {
  const db = getDb();

  const tx = db.transaction(() => {
    // 1. Data catatan & to-do
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM todos WHERE user_id = ?').run(userId);

    // 2. Data pengingat
    db.prepare('DELETE FROM reminders WHERE user_id = ?').run(userId);

    // 3. Fakta ingatan jangka panjang
    db.prepare('DELETE FROM user_facts WHERE user_id = ?').run(userId);

    // 4. Catatan keuangan
    db.prepare('DELETE FROM expenses WHERE user_id = ?').run(userId);

    // 5. Jurnal suasana hati (moods)
    db.prepare('DELETE FROM moods WHERE user_id = ?').run(userId);

    // 6. Kebiasaan & log habit
    db.prepare(
      `DELETE FROM habit_logs WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ?)`,
    ).run(userId);
    db.prepare('DELETE FROM habits WHERE user_id = ?').run(userId);

    // 7. Kedekatan & game
    db.prepare('DELETE FROM affinity WHERE user_id = ?').run(userId);
    try {
      db.prepare('DELETE FROM persona_affinity WHERE user_id = ?').run(userId);
    } catch {}
    db.prepare('DELETE FROM game_scores WHERE user_id = ?').run(userId);

    // 8. Persona custom & chat proaktif
    db.prepare('DELETE FROM custom_personas WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM proactive_settings WHERE user_id = ?').run(userId);

    // 9. Riwayat pesan, ringkasan, dan pemakaian token
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(userId);
    db.prepare('DELETE FROM summaries WHERE chat_id = ?').run(userId);
    try {
      db.prepare('DELETE FROM persona_summaries WHERE chat_id = ?').run(userId);
    } catch {}
    db.prepare('DELETE FROM usage WHERE user_id = ?').run(userId);

    // 10. Profil pengguna di tabel users
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  tx();

  return { success: true, userId };
}

/**
 * Privacy policy and data management text in English.
 * @returns {string}
 */
export function getPrivacyPolicyText() {
  return [
    '*Privacy Policy & Data Management*',
    '',
    'We respect your privacy and full control over your personal data:',
    '',
    '1. *What Data Is Stored?*',
    '• Basic Telegram profile (ID, first name, username) for personalized greetings.',
    '• User-created content: notes (/note), to-dos (/todo), reminders (/remind), expenses (/catat), and mood entries (/mood).',
    '• User preferences: timezone, active personality, and GIF frequency.',
    '',
    '2. *Where Is Data Stored?*',
    '• All data is stored locally in an SQLite database on the bot server.',
    '• Your data is *NEVER* sold, shared, or transferred to any third party.',
    '• Photos/images sent for AI vision analysis are *NEVER* stored to disk (streamed via memory directly to the model gateway).',
    '',
    '3. *Your Rights & Control:*',
    '• `/export`: Download a full copy of your personal data anytime in JSON format.',
    '• `/deleteme`: Permanently delete all your personal records from the bot (two-step confirmation).',
    '• `/forget`: Clear recent conversation history and current chat summary.',
  ].join('\n');
}
