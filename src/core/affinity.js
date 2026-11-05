import { getDb } from './db.js';
import { getZonedParts } from './time_parser.js';

export const DAILY_POINTS_CAP = 15;
export const POINTS_PER_INTERACTION = 2;

export const LEVEL_TARGET_POINTS = {
  0: 0,
  1: 35,
  2: 75,
  3: 150,
  4: 250,
};

export const AFFINITY_LEVELS = [
  {
    level: 0,
    title: 'Stranger',
    minPoints: 0,
    nextThreshold: 20,
    promptInstruction:
      'Level 0 (Stranger): Distant and guarded. Respond as necessary without being overly familiar.',
  },
  {
    level: 1,
    title: 'Familiar Face',
    minPoints: 20,
    nextThreshold: 50,
    promptInstruction:
      'Level 1 (Familiar Face): More accustomed to user. Maintains clear boundaries but conversational.',
  },
  {
    level: 2,
    title: 'Growing Trust',
    minPoints: 50,
    nextThreshold: 100,
    promptInstruction:
      'Level 2 (Growing Trust): Proactively helpful, checks on user practically, reliable and warmer.',
  },
  {
    level: 3,
    title: 'Trusted Companion',
    minPoints: 100,
    nextThreshold: 200,
    promptInstruction:
      'Level 3 (Trusted Companion): Open, supportive, willing to listen and share advice sincerely.',
  },
  {
    level: 4,
    title: 'Deep Trust',
    minPoints: 200,
    nextThreshold: null,
    promptInstruction:
      'Level 4 (Deep Trust): Deeply supportive, protective and steadily present. Expresses genuine care and appreciation.',
  },
];

export const ENGLISH_AFFINITY_LEVELS = [
  {
    level: 0,
    title: 'Stranger',
    promptInstruction:
      'Level 0 (Stranger): Formal or sharp, distant, cautious. Respond only as necessary without unprovoked hostility.',
  },
  {
    level: 1,
    title: 'Familiar Face',
    promptInstruction:
      'Level 1 (Familiar Face): Speaks more freely, but maintains clear boundaries. Blunt, observant, and occasionally exasperated.',
  },
  {
    level: 2,
    title: 'Growing Trust',
    promptInstruction:
      'Level 2 (Growing Trust): Proactively helpful, checks on user practically. Still strict and demanding, but tone is steady and reliable.',
  },
  {
    level: 3,
    title: 'Trusted Companion',
    promptInstruction:
      'Level 3 (Trusted Companion): Readily shares advice and offers concrete support. Willing to listen during difficult moments without unnecessary mockery.',
  },
  {
    level: 4,
    title: 'Deep Trust',
    promptInstruction:
      'Level 4 (Deep Trust): Protective and steadily present. Expresses care through practical actions and simple words of gratitude. Remains firm; NEVER turns sweet, submissive, or romantic.',
  },
];

export function computeLevel(points) {
  if (points >= 200) return 4;
  if (points >= 100) return 3;
  if (points >= 50) return 2;
  if (points >= 20) return 1;
  return 0;
}

export function getLevelInfo(level) {
  return (
    AFFINITY_LEVELS.find((l) => l.level === level) ?? AFFINITY_LEVELS[0]
  );
}

export function getTodayDateStr(now = Date.now(), tz = 'Asia/Jakarta') {
  const parts = getZonedParts(new Date(now), tz);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Ambil status affinity user saat ini. Menerapkan peluruhan sangat lambat jika lama tidak interaksi (> 7 hari).
 */
export function getAffinity(userId, tz = 'Asia/Jakarta', now = Date.now(), personaId = 'tsundere') {
  const pId = personaId || 'tsundere';
  const db = getDb();
  let row = null;

  try {
    row = db
      .prepare('SELECT * FROM persona_affinity WHERE user_id = ? AND persona_id = ?')
      .get(userId, pId);
  } catch {}

  // Fallback ke tabel affinity jika personaId adalah tsundere dan belum ada di persona_affinity
  if (!row && pId === 'tsundere') {
    try {
      row = db
        .prepare('SELECT * FROM affinity WHERE user_id = ?')
        .get(userId);
    } catch {}
  }

  const isEn = pId !== 'legacy_id';

  if (!row) {
    const enInfo = ENGLISH_AFFINITY_LEVELS[0];
    return {
      userId,
      personaId: pId,
      points: 0,
      level: 0,
      title: isEn ? enInfo.title : AFFINITY_LEVELS[0].title,
      gainedToday: 0,
      dailyCap: DAILY_POINTS_CAP,
      lastGainDate: null,
      lastChatAt: now,
      promptInstruction: isEn ? enInfo.promptInstruction : AFFINITY_LEVELS[0].promptInstruction,
      nextThreshold: AFFINITY_LEVELS[0].nextThreshold,
    };
  }

  const todayStr = getTodayDateStr(now, tz);
  let gainedToday = row.last_gain_date === todayStr ? row.gained_today : 0;
  let points = row.points;

  // Peluruhan sangat lambat (gentle decay): 1 poin per 7 hari tanpa interaksi
  const daysInactive = Math.floor((now - row.last_chat_at) / (24 * 3600_000));
  if (daysInactive >= 7) {
    const decayPoints = Math.floor(daysInactive / 7);
    points = Math.max(0, points - decayPoints);
  }

  const level = computeLevel(points);
  const info = getLevelInfo(level);
  const enInfo = ENGLISH_AFFINITY_LEVELS[level] ?? ENGLISH_AFFINITY_LEVELS[0];

  return {
    userId,
    personaId: pId,
    points,
    level,
    title: isEn ? enInfo.title : info.title,
    gainedToday,
    dailyCap: DAILY_POINTS_CAP,
    lastGainDate: row.last_gain_date,
    lastChatAt: row.last_chat_at,
    promptInstruction: isEn ? enInfo.promptInstruction : info.promptInstruction,
    nextThreshold: info.nextThreshold,
  };
}

/**
 * Catat interaksi pesan baru user dan tambahkan poin kedekatan jika belum melewati batas harian.
 */
export function recordInteraction(userId, tz = 'Asia/Jakarta', now = Date.now(), personaId = 'tsundere') {
  const pId = personaId || 'tsundere';
  const db = getDb();
  const todayStr = getTodayDateStr(now, tz);
  const current = getAffinity(userId, tz, now, pId);

  const remainingDaily = Math.max(0, DAILY_POINTS_CAP - current.gainedToday);
  const pointsToAdd = Math.min(POINTS_PER_INTERACTION, remainingDaily);

  const newPoints = current.points + pointsToAdd;
  const newGainedToday = current.gainedToday + pointsToAdd;
  const newLevel = computeLevel(newPoints);

  try {
    db.prepare(
      `INSERT INTO persona_affinity (user_id, persona_id, points, level, last_gain_date, gained_today, last_chat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, persona_id) DO UPDATE SET
         points = excluded.points,
         level = excluded.level,
         last_gain_date = excluded.last_gain_date,
         gained_today = excluded.gained_today,
         last_chat_at = excluded.last_chat_at`,
    ).run(userId, pId, newPoints, newLevel, todayStr, newGainedToday, now);
  } catch {}

  // Jika tidak ada personaId atau persona default, perbarui juga tabel global affinity
  if (pId === 'tsundere') {
    try {
      db.prepare(
        `INSERT INTO affinity (user_id, points, level, last_gain_date, gained_today, last_chat_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           points = excluded.points,
           level = excluded.level,
           last_gain_date = excluded.last_gain_date,
           gained_today = excluded.gained_today,
           last_chat_at = excluded.last_chat_at`,
      ).run(userId, newPoints, newLevel, todayStr, newGainedToday, now);
    } catch {}
  }

  return {
    userId,
    personaId: pId,
    points: newPoints,
    level: newLevel,
    addedPoints: pointsToAdd,
    gainedToday: newGainedToday,
    dailyCap: DAILY_POINTS_CAP,
  };
}

/**
 * Ubah level affinity secara manual dan langsung untuk user dan persona tertentu.
 * Menyetel poin ke target level, mempertahankan statistik harian (gainedToday & lastGainDate),
 * dan memperbarui last_chat_at agar tidak langsung mengalami peluruhan.
 *
 * @param {number} userId
 * @param {string} [personaId='tsundere']
 * @param {number|string} targetLevel
 * @param {string} [tz='Asia/Jakarta']
 * @param {number} [now=Date.now()]
 * @returns {object} updated affinity object
 */
export function setAffinityLevel(
  userId,
  personaId = 'tsundere',
  targetLevel,
  tz = 'Asia/Jakarta',
  now = Date.now(),
) {
  const pId = personaId || 'tsundere';
  if (
    targetLevel === null ||
    targetLevel === undefined ||
    typeof targetLevel === 'object' ||
    (typeof targetLevel === 'string' && targetLevel.trim() === '')
  ) {
    throw new Error('Invalid affinity level: must be an integer between 0 and 4, or "min" / "max"');
  }

  let lvl;
  if (targetLevel === 'min') {
    lvl = 0;
  } else if (targetLevel === 'max') {
    lvl = 4;
  } else {
    lvl = Number(targetLevel);
  }

  if (!Number.isInteger(lvl) || lvl < 0 || lvl > 4) {
    throw new Error('Invalid affinity level: must be an integer between 0 and 4, or "min" / "max"');
  }

  const targetPoints = LEVEL_TARGET_POINTS[lvl];
  const db = getDb();
  const todayStr = getTodayDateStr(now, tz);
  const current = getAffinity(userId, tz, now, pId);

  const lastGainDate = current.lastGainDate ?? todayStr;
  const gainedToday = current.gainedToday ?? 0;

  db.prepare(
    `INSERT INTO persona_affinity (user_id, persona_id, points, level, last_gain_date, gained_today, last_chat_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, persona_id) DO UPDATE SET
       points = excluded.points,
       level = excluded.level,
       last_gain_date = excluded.last_gain_date,
       gained_today = excluded.gained_today,
       last_chat_at = excluded.last_chat_at`,
  ).run(userId, pId, targetPoints, lvl, lastGainDate, gainedToday, now);

  if (pId === 'tsundere') {
    try {
      db.prepare(
        `INSERT INTO affinity (user_id, points, level, last_gain_date, gained_today, last_chat_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           points = excluded.points,
           level = excluded.level,
           last_gain_date = excluded.last_gain_date,
           gained_today = excluded.gained_today,
           last_chat_at = excluded.last_chat_at`,
      ).run(userId, targetPoints, lvl, lastGainDate, gainedToday, now);
    } catch {}
  }

  return getAffinity(userId, tz, now, pId);
}

