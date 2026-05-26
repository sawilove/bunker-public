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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_idx
    ON users (nickname_lower);
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
    gamesPlayed: row.games_played,
    bunkerSurvivals: row.bunker_survivals,
    createdAt: row.created_at,
  };
}

module.exports = {
  getPool,
  initDatabase,
  rowToUser,
};
