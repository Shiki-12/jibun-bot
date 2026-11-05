-- Migrasi 024: Backfill data legacy affinity ke persona_affinity
-- Memetakan user_id dari affinity ke satu persona default/tersimpan user (users.persona atau 'tsundere')
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
LEFT JOIN users u ON a.user_id = u.id;

