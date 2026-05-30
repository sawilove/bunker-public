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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS dev BOOLEAN NOT NULL DEFAULT false;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_webp BYTEA;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_updated_at TIMESTAMPTZ;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS friends_hidden BOOLEAN NOT NULL DEFAULT false;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lower TEXT;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_id TEXT;
  `);
  await p.query(`
    UPDATE users
    SET profile_id = id
    WHERE profile_id IS NULL OR profile_id = '';
  `);
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_profile_id_idx
    ON users (profile_id);
  `);
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
    ON users (email_lower) WHERE email_lower IS NOT NULL;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS email_codes (
      email_lower TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (email_lower, purpose)
    );
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
  await p.query(`
    CREATE TABLE IF NOT EXISTS news_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'dev',
      media JSONB NOT NULL DEFAULT '[]',
      published_at DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      author_id TEXT REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_backstory JSONB;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS news_media (
      id TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS scenario_catalog (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      location_label TEXT NOT NULL DEFAULT 'В бункере',
      scene_key TEXT,
      cover_webp BYTEA,
      card_pool_preset TEXT NOT NULL DEFAULT 'standard',
      card_pool_custom JSONB,
      status TEXT NOT NULL DEFAULT 'draft',
      review_note TEXT,
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS scenario_catalog_status_idx
    ON scenario_catalog (status);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS scenario_catalog_author_idx
    ON scenario_catalog (author_id);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS scenario_catalog_published_idx
    ON scenario_catalog (status, updated_at DESC);
  `);
  await p.query(`
    ALTER TABLE scenario_catalog ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]';
  `);
  await p.query(`
    ALTER TABLE scenario_catalog ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0;
  `);
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    profileId: row.profile_id || row.id,
    nickname: row.nickname,
    nicknameLower: row.nickname_lower,
    passwordHash: row.password_hash,
    bio: row.bio || "",
    avatarWebp: row.avatar_webp,
    avatarUpdatedAt: row.avatar_updated_at,
    bannerWebp: row.banner_webp,
    bannerUpdatedAt: row.banner_updated_at,
    friendsHidden: !!row.friends_hidden,
    gamesPlayed: row.games_played,
    bunkerSurvivals: row.bunker_survivals,
    premium: !!row.premium,
    premiumUntil: row.premium_until || null,
    dev: !!row.dev,
    email: row.email || null,
    emailLower: row.email_lower || null,
    emailVerified: !!row.email_verified,
    customBackstory: row.custom_backstory || null,
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
