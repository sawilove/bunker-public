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
  await p.query(`
    ALTER TABLE scenario_catalog ADD COLUMN IF NOT EXISTS rating_sum INTEGER NOT NULL DEFAULT 0;
  `);
  await p.query(`
    ALTER TABLE scenario_catalog ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS scenario_ratings (
      catalog_id TEXT NOT NULL REFERENCES scenario_catalog(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (catalog_id, user_id)
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS scenario_ratings_catalog_idx
    ON scenario_ratings (catalog_id);
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS displayed_achievements JSONB NOT NULL DEFAULT '[]';
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      progress INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, achievement_id)
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      href TEXT NOT NULL DEFAULT '',
      icon_url TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}',
      dedupe_key TEXT,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx
    ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON notifications (user_id, created_at DESC);
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id),
      CHECK (blocker_id <> blocked_id)
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS user_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL DEFAULT 'other',
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS user_reports_status_idx
    ON user_reports (status, created_at DESC);
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      plan_days INTEGER NOT NULL DEFAULT 30,
      comment TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'cloudtips',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS activity_events_created_idx
    ON activity_events (created_at DESC);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS activity_events_user_idx
    ON activity_events (user_id, created_at DESC);
  `);
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_hidden BOOLEAN NOT NULL DEFAULT false;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS bunker_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL REFERENCES bunker_groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (group_id, user_id)
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS group_members_user_idx
    ON group_members (user_id);
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES bunker_groups(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS group_messages_group_idx
    ON group_messages (group_id, created_at DESC);
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS scenario_comments (
      id TEXT PRIMARY KEY,
      catalog_id TEXT NOT NULL REFERENCES scenario_catalog(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS scenario_comments_catalog_idx
    ON scenario_comments (catalog_id, created_at DESC);
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS scenario_favorites (
      catalog_id TEXT NOT NULL REFERENCES scenario_catalog(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (catalog_id, user_id)
    );
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
    displayedAchievements: row.displayed_achievements || [],
    activityHidden: !!row.activity_hidden,
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
