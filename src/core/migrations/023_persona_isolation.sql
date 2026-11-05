-- Migrasi 023: Isolasi percakapan, ringkasan, dan affinity per persona
-- 1. Tambah kolom persona_id pada tabel messages
ALTER TABLE messages ADD COLUMN persona_id TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_chat_persona ON messages(chat_id, persona_id, id);

-- 2. Tabel ringkasan percakapan per (chat_id, persona_id)
CREATE TABLE IF NOT EXISTS persona_summaries (
  chat_id INTEGER NOT NULL,
  persona_id TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, persona_id)
);

-- 3. Tabel affinity kedekatan terisolasi per (user_id, persona_id)
CREATE TABLE IF NOT EXISTS persona_affinity (
  user_id INTEGER NOT NULL,
  persona_id TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0,
  last_gain_date TEXT,
  gained_today INTEGER DEFAULT 0,
  last_chat_at INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_affinity_user ON persona_affinity(user_id, persona_id);

