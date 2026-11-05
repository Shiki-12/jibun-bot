import { getDb } from './db.js';

/**
 * Ambil daftar fakta stabil user (maksimal limit).
 */
export function getFacts(userId, limit = 15) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM user_facts
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(userId, limit);
}

/**
 * Tambah fakta baru tentang user (otomatis deduplikasi lewat UNIQUE).
 */
export function addFact(userId, fact) {
  if (!fact || typeof fact !== 'string') return null;
  const cleanFact = fact.trim();
  if (cleanFact.length < 3 || cleanFact.length > 300) return null;

  const db = getDb();
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO user_facts (user_id, fact, created_at)
       VALUES (?, ?, ?)`,
    )
    .run(userId, cleanFact, Date.now());

  return info.changes > 0 ? info.lastInsertRowid : null;
}

/**
 * Hapus satu fakta berdasarkan ID dan kepemilikan user.
 */
export function deleteFact(userId, factId) {
  const db = getDb();
  const res = db
    .prepare(`DELETE FROM user_facts WHERE id = ? AND user_id = ?`)
    .run(factId, userId);
  return res.changes > 0;
}

/**
 * Hapus seluruh fakta untuk seorang user.
 */
export function clearFacts(userId) {
  const db = getDb();
  const res = db
    .prepare(`DELETE FROM user_facts WHERE user_id = ?`)
    .run(userId);
  return res.changes;
}

/**
 * Ambil ringkasan riwayat percakapan lama untuk chat (opsional per persona).
 */
export function getSummary(chatId, personaId = null) {
  const db = getDb();
  if (personaId) {
    try {
      const pRow = db
        .prepare(`SELECT text FROM persona_summaries WHERE chat_id = ? AND persona_id = ?`)
        .get(chatId, personaId);
      if (pRow?.text) return pRow.text;
    } catch {}

    // Fallback untuk persona default legacy
    if (personaId !== 'jiang_cheng') {
      const row = db
        .prepare(`SELECT text FROM summaries WHERE chat_id = ?`)
        .get(chatId);
      return row?.text ?? null;
    }
    return null;
  }

  const row = db
    .prepare(`SELECT text FROM summaries WHERE chat_id = ?`)
    .get(chatId);
  return row?.text ?? null;
}

/**
 * Simpan atau perbarui ringkasan riwayat percakapan untuk chat (opsional per persona).
 */
export function saveSummary(chatId, text, personaId = null) {
  if (!text || typeof text !== 'string') return;
  const clean = text.trim();
  const db = getDb();

  if (personaId) {
    try {
      db.prepare(
        `INSERT INTO persona_summaries (chat_id, persona_id, text, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(chat_id, persona_id) DO UPDATE SET
           text = excluded.text,
           updated_at = excluded.updated_at`,
      ).run(chatId, personaId, clean, Date.now());
    } catch {}
  }

  // Jika bukan persona exclusive, sinkronkan juga ke tabel summaries
  if (!personaId || personaId !== 'jiang_cheng') {
    db.prepare(
      `INSERT INTO summaries (chat_id, text, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         text = excluded.text,
         updated_at = excluded.updated_at`,
    ).run(chatId, clean, Date.now());
  }
}

/**
 * Hapus ringkasan riwayat percakapan untuk chat (opsional per persona).
 */
export function clearSummary(chatId, personaId = null) {
  const db = getDb();
  if (personaId) {
    try {
      db.prepare(`DELETE FROM persona_summaries WHERE chat_id = ? AND persona_id = ?`).run(chatId, personaId);
    } catch {}
    if (personaId !== 'jiang_cheng') {
      db.prepare(`DELETE FROM summaries WHERE chat_id = ?`).run(chatId);
    }
  } else {
    try {
      db.prepare(`DELETE FROM persona_summaries WHERE chat_id = ?`).run(chatId);
    } catch {}
    db.prepare(`DELETE FROM summaries WHERE chat_id = ?`).run(chatId);
  }
}

/**
 * Parsing teks respons LLM menjadi array of string fakta.
 */
export function parseFactsJson(raw) {
  if (!raw || typeof raw !== 'string') return [];

  let text = raw.trim();
  // Hilangkan format markdown ```json ... ``` bila ada
  const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlock) {
    text = jsonBlock[1].trim();
  }

  // Cari blok array [...] bila masih ada teks pengantar
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    text = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => typeof item === 'string' && item.trim().length >= 3)
        .map((item) => item.trim());
    }
  } catch {}

  return [];
}

/**
 * Ekstrak fakta baru dari percakapan terakhir menggunakan LLM.
 */
export async function extractAndSaveFacts({
  userId,
  chatId,
  generateReplyFn,
}) {
  if (typeof generateReplyFn !== 'function') return [];

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT role, text FROM messages
       WHERE chat_id = ?
       ORDER BY id DESC
       LIMIT 20`,
    )
    .all(chatId)
    .reverse();

  if (rows.length < 2) return [];

  const conversationTranscript = rows
    .map((r) => `${r.role === 'user' ? 'User' : 'Bot'}: ${r.text}`)
    .join('\n');

  const systemPrompt = `You are a long-term fact extraction system.
Task: Extract stable and relevant facts about the User from the following conversation excerpt (e.g., nickname/name, occupation/major, hobbies, favorite food, pets, personal preferences, routines, regular schedule).

SAFETY & PRIVACY RULES (ABSOLUTE):
1. STRICTLY FORBIDDEN to store sensitive data: passwords, PINs, bank accounts, credit card numbers, national ID/confidential identity numbers, or personal medical diagnoses/illness details.
2. ONLY extract facts explicitly stated by the User about themselves. Do not guess or extrapolate.
3. ONLY return a JSON array of strings without formatting or additional explanation.
   Example: ["Likes black coffee without sugar", "Has a pet cat named Mochi"]
4. If no new or stable facts are found, return: []`;

  try {
    const raw = await generateReplyFn({
      systemPrompt,
      history: [],
      userText: `Conversation excerpt:\n${conversationTranscript}\n\nExtract stable facts about the user in JSON array format:`,
    });

    const facts = parseFactsJson(raw);
    const saved = [];
    for (const f of facts) {
      const id = addFact(userId, f);
      if (id) saved.push({ id, fact: f });
    }
    return saved;
  } catch (err) {
    console.error('Gagal mengekstrak fakta memori:', err.message);
    return [];
  }
}

/**
 * Rangkum percakapan lama jika jumlah pesan melebihi ambang batas (threshold).
 */
export async function summarizeOlderHistory({
  chatId,
  generateReplyFn,
  threshold = 24,
  batchSize = 12,
  personaId = null,
}) {
  if (typeof generateReplyFn !== 'function') return null;

  const db = getDb();
  let count = 0;
  if (personaId) {
    const countRow = db
      .prepare(`SELECT count(*) as count FROM messages WHERE chat_id = ? AND persona_id = ?`)
      .get(chatId, personaId);
    count = countRow?.count ?? 0;
  } else {
    const countRow = db
      .prepare(`SELECT count(*) as count FROM messages WHERE chat_id = ?`)
      .get(chatId);
    count = countRow?.count ?? 0;
  }

  if (count <= threshold) return null;

  // Ambil pesan paling lama sebanyak batchSize
  let oldRows;
  if (personaId) {
    oldRows = db
      .prepare(
        `SELECT id, role, text FROM messages
         WHERE chat_id = ? AND persona_id = ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(chatId, personaId, batchSize);
  } else {
    oldRows = db
      .prepare(
        `SELECT id, role, text FROM messages
         WHERE chat_id = ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(chatId, batchSize);
  }

  if (oldRows.length === 0) return null;

  const oldTranscript = oldRows
    .map((r) => `${r.role === 'user' ? 'User' : 'Bot'}: ${r.text}`)
    .join('\n');

  const isEn = true;
  const existingSummary = getSummary(chatId, personaId);
  let prompt = 'Summarize the essence of this past conversation concisely and objectively in 1-2 short paragraphs in English. Include key topics and important points discussed.';

  if (existingSummary) {
    prompt += `\n\nPrevious conversation summary:\n${existingSummary}`;
  }

  try {
    const newSummary = await generateReplyFn({
      systemPrompt: 'You are a conversation memory summarizer assistant. Always output summaries in English.',
      history: [],
      userText: `${prompt}\n\nConversation to summarize:\n${oldTranscript}\n\nConcise English summary:`,
    });

    if (newSummary && newSummary.trim().length > 10) {
      saveSummary(chatId, newSummary.trim(), personaId);

      // Hapus pesan lama yang sudah terangkum agar tabel tetap ramping
      const idsToDelete = oldRows.map((r) => r.id);
      db.prepare(
        `DELETE FROM messages WHERE id IN (${idsToDelete.map(() => '?').join(',')})`,
      ).run(...idsToDelete);

      return newSummary.trim();
    }
  } catch (err) {
    console.error('Gagal merangkum riwayat percakapan lama:', err.message);
  }

  return null;
}

