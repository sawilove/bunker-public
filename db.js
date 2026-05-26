const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL не задан");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

async function initDatabase() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      nickname_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      avatar_webp BYTEA,
      games_played INTEGER NOT NULL DEFAULT 0,
      bunker_survivals INTEGER NOT NULL DEFAULT 0,
      premium BOOLEAN NOT NULL DEFAULT false,
      dev BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_idx
    ON users (nickname_lower);
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS premium BOOLEAN NOT NULL DEFAULT false;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS dev BOOLEAN NOT NULL DEFAULT false;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS friend_pairs (
      user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_a, user_b),
      CHECK (user_a < user_b)
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS chat_messages_thread_idx
    ON chat_messages (from_user_id, to_user_id, created_at DESC);
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    nicknameLower: row.nickname_lower,
    passwordHash: row.password_hash,
    bio: row.bio || "",
    avatarWebp: row.avatar_webp,
    avatarUpdatedAt: row.avatar_updated_at,
    gamesPlayed: row.games_played,
    bunkerSurvivals: row.bunker_survivals,
    premium: !!row.premium,
    dev: !!row.dev,
    createdAt: row.created_at,
  };
}

function pairKey(userId, peerId) {
  return userId < peerId ? [userId, peerId] : [peerId, userId];
}

module.exports = {
  getPool,
  initDatabase,
  rowToUser,
  pairKey,
};
