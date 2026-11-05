import { getDb } from './core/db.js';

const MAX_MESSAGES = Number(process.env.MAX_HISTORY ?? 24);

/**
 * Simpan segera (checkpoint WAL saat bot dimatikan).
 */
export function flush() {
  try {
    const db = getDb();
    db.pragma('wal_checkpoint(PASSIVE)');
  } catch {}
}

/**
 * Riwayat chat dalam format { role: 'user' | 'model', text }.
 * Mengambil N pesan terakhir dalam urutan kronologis, dengan isolasi per persona jika personaId disertakan.
 */
export function getHistory(chatId, personaId = null) {
  const db = getDb();
  let rows;

  if (personaId) {
    rows = db
      .prepare(
        `SELECT role, text FROM messages
         WHERE chat_id = ? AND (persona_id = ? OR (persona_id IS NULL AND ? = 'tsundere'))
         ORDER BY id DESC LIMIT ?`,
      )
      .all(chatId, personaId, personaId, MAX_MESSAGES)
      .reverse();
  } else {
    rows = db
      .prepare(
        'SELECT role, text FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?',
      )
      .all(chatId, MAX_MESSAGES)
      .reverse();
  }

  // Sebagian API LLM mengharapkan percakapan diawali dari giliran 'user'.
  while (rows.length && rows[0].role !== 'user') {
    rows.shift();
  }

  return rows;
}

/**
 * Tambah pesan baru ke riwayat percakapan chat.
 */
export function addMessage(chatId, role, text, personaId = null) {
  const db = getDb();
  db.prepare(
    'INSERT INTO messages (chat_id, role, text, created_at, persona_id) VALUES (?, ?, ?, ?, ?)',
  ).run(chatId, role, text, Date.now(), personaId);
}

/**
 * Hapus riwayat percakapan untuk chat tertentu (opsional per persona).
 */
export function clearHistory(chatId, personaId = null) {
  const db = getDb();
  if (personaId) {
    db.prepare('DELETE FROM messages WHERE chat_id = ? AND persona_id = ?').run(chatId, personaId);
  } else {
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
  }
}
