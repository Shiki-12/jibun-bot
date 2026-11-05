import { getDb } from './db.js';

export const MOOD_LEVELS = {
  1: { score: 1, label: 'Very Bad', emoji: '(T_T)', bar: '█░░░░' },
  2: { score: 2, label: 'Bad', emoji: '(._.)', bar: '██░░░' },
  3: { score: 3, label: 'Neutral', emoji: '(-_-)', bar: '███░░' },
  4: { score: 4, label: 'Good', emoji: '(^_^)', bar: '████░' },
  5: { score: 5, label: 'Very Good', emoji: '(^▽^)', bar: '█████' },
};

export const CRISIS_KEYWORDS = [
  'bunuh diri',
  'suicide',
  'akhiri hidup',
  'mengakhiri hidup',
  'pengen mati',
  'mau mati',
  'menyakiti diri',
  'self harm',
  'potong nadi',
  'kill myself',
  'want to die',
  'end my life',
  'cut my wrists',
];

export function hasCrisisSigns(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export function formatDateStr(timestamp, tz = 'Asia/Jakarta') {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(timestamp);
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

export function recordMood({
  userId,
  score,
  note = null,
  tz = 'Asia/Jakarta',
  now = Date.now(),
  db = getDb(),
}) {
  const numScore = Number(score);
  if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) {
    throw new Error('Skor mood harus berupa angka bulat antara 1 sampai 5');
  }

  const cleanNote = note ? String(note).trim().slice(0, 500) : null;
  const dateStr = formatDateStr(now, tz);

  const stmt = db.prepare(`
    INSERT INTO moods (user_id, score, note, date_str, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(userId, numScore, cleanNote, dateStr, now);

  return db.prepare('SELECT * FROM moods WHERE id = ?').get(info.lastInsertRowid);
}

export function getTodayMood(userId, tz = 'Asia/Jakarta', now = Date.now(), db = getDb()) {
  const dateStr = formatDateStr(now, tz);
  return (
    db
      .prepare(
        'SELECT * FROM moods WHERE user_id = ? AND date_str = ? ORDER BY id DESC LIMIT 1',
      )
      .get(userId, dateStr) ?? null
  );
}

export function getUserMoodsLast7Days(userId, now = Date.now(), db = getDb()) {
  const sevenDaysAgo = now - 7 * 24 * 3600_000;
  return db
    .prepare(
      `SELECT * FROM moods
       WHERE user_id = ? AND created_at >= ?
       ORDER BY created_at ASC`,
    )
    .all(userId, sevenDaysAgo);
}

export function deleteMood(id, userId, db = getDb()) {
  const res = db
    .prepare('DELETE FROM moods WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return res.changes > 0;
}

export function renderMoodWeekSummary(moods, tz = 'Asia/Jakarta') {
  if (!Array.isArray(moods) || moods.length === 0) {
    return null;
  }

  let totalScore = 0;
  const lines = moods.map((m) => {
    totalScore += m.score;
    const meta = MOOD_LEVELS[m.score] || { emoji: '(-_-)', bar: '███░░', label: 'Neutral' };

    let dateLabel = m.date_str;
    try {
      dateLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        day: '2-digit',
        month: 'short',
      }).format(m.created_at);
    } catch {}

    const notePart = m.note ? ` — _"${m.note}"_` : '';
    return `• *${dateLabel}:* [${meta.bar}] ${meta.emoji} (${m.score}/5)${notePart}`;
  });

  const avg = (totalScore / moods.length).toFixed(1);

  return (
    `*7-Day Mood Journal*\n\n` +
    `${lines.join('\n')}\n\n` +
    `*Average:* *${avg}* / 5.0 (${moods.length} entries)\n\n` +
    `_Note: This journal is a personal reflection and not a substitute for professional medical diagnosis or therapy._`
  );
}

