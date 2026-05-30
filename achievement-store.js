const { getPool } = require("./db");
const { getUserById, hasPremiumAccess } = require("./user-store");
const {
  ACHIEVEMENTS,
  ACHIEVEMENT_LIST,
  MAX_DISPLAYED_ACHIEVEMENTS,
  PIONEER_MAX_RANK,
  CATALOG_STAR_MIN_RATINGS,
  achievementIconPath,
} = require("./achievement-data");

async function getUnlockedMap(userId) {
  const { rows } = await getPool().query(
    `SELECT achievement_id, unlocked_at, progress FROM user_achievements WHERE user_id = $1`,
    [userId]
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.achievement_id, {
      unlockedAt: row.unlocked_at,
      progress: row.progress || 0,
    });
  }
  return map;
}

async function grantAchievement(userId, achievementId) {
  if (!ACHIEVEMENTS[achievementId]) return false;
  const { rowCount } = await getPool().query(
    `INSERT INTO user_achievements (user_id, achievement_id, progress)
     VALUES ($1, $2, 0)
     ON CONFLICT (user_id, achievement_id) DO NOTHING`,
    [userId, achievementId]
  );
  return rowCount > 0;
}

async function countFriends(userId) {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS c FROM friend_pairs
     WHERE (user_a = $1 OR user_b = $1) AND status = 'accepted'`,
    [userId]
  );
  return rows[0]?.c || 0;
}

async function countPublishedScenarios(userId) {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS c FROM scenario_catalog
     WHERE author_id = $1 AND status = 'published'`,
    [userId]
  );
  return rows[0]?.c || 0;
}

async function getUniqueAchievementFlags(userId) {
  const p = getPool();
  const [{ rows: rankRows }, { rows: newsRows }, { rows: ratingRows }, { rows: modRows }] =
    await Promise.all([
      p.query(
        `SELECT COUNT(*)::int AS rank FROM users
         WHERE created_at <= (SELECT created_at FROM users WHERE id = $1)`,
        [userId]
      ),
      p.query(`SELECT 1 FROM news_posts WHERE author_id = $1 LIMIT 1`, [userId]),
      p.query(
        `SELECT COALESCE(MAX(rating_count), 0)::int AS max_ratings
         FROM scenario_catalog WHERE author_id = $1 AND status = 'published'`,
        [userId]
      ),
      p.query(`SELECT 1 FROM scenario_catalog WHERE reviewed_by = $1 LIMIT 1`, [userId]),
    ]);
  return {
    registrationRank: rankRows[0]?.rank || 9999,
    hasNewsPost: newsRows.length > 0,
    maxScenarioRatings: ratingRows[0]?.max_ratings || 0,
    hasReviewedScenario: modRows.length > 0,
  };
}

async function buildAchievementContext(userId) {
  const user = await getUserById(userId);
  if (!user) return null;
  const [friendsCount, publishedScenarios, uniqueFlags] = await Promise.all([
    countFriends(userId),
    countPublishedScenarios(userId),
    getUniqueAchievementFlags(userId),
  ]);
  return {
    user,
    gamesPlayed: user.gamesPlayed || 0,
    bunkerSurvivals: user.bunkerSurvivals || 0,
    friendsCount,
    publishedScenarios,
    hasAvatar: !!user.avatarWebp,
    hasBio: !!(user.bio || "").trim(),
    premium: hasPremiumAccess(user),
    dev: !!user.dev,
    ...uniqueFlags,
  };
}

function isAchievementUnlocked(ach, ctx, unlockedMap) {
  if (unlockedMap.has(ach.id)) return true;

  if (ach.type === "unique") {
    switch (ach.id) {
      case "bunker_dev":
        return ctx.dev;
      case "pioneer_bunker":
        return ctx.registrationRank > 0 && ctx.registrationRank <= PIONEER_MAX_RANK;
      case "news_voice":
        return ctx.hasNewsPost;
      case "catalog_star":
        return ctx.maxScenarioRatings >= CATALOG_STAR_MIN_RATINGS;
      case "catalog_editor":
        return ctx.hasReviewedScenario;
      default:
        return false;
    }
  }

  if (ach.type === "once") {
    switch (ach.id) {
      case "register":
        return true;
      case "first_game":
        return ctx.gamesPlayed >= 1;
      case "first_survival":
        return ctx.bunkerSurvivals >= 1;
      case "avatar_upload":
        return ctx.hasAvatar;
      case "bio_filled":
        return ctx.hasBio;
      case "first_friend":
        return ctx.friendsCount >= 1;
      case "scenario_published":
        return ctx.publishedScenarios >= 1;
      case "premium_member":
        return ctx.premium;
      default:
        return false;
    }
  }

  if (ach.type === "goal" && ach.goalKey) {
    const val = ctx[ach.goalKey] ?? 0;
    return val >= (ach.goalTarget || 0);
  }

  return false;
}

function achievementProgress(ach, ctx) {
  if (ach.type !== "goal" || !ach.goalKey) return null;
  const current = ctx[ach.goalKey] ?? 0;
  const target = ach.goalTarget || 1;
  return { current: Math.min(current, target), target };
}

async function syncAchievementsForUser(userId) {
  const ctx = await buildAchievementContext(userId);
  if (!ctx) return [];

  const unlockedMap = await getUnlockedMap(userId);
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENT_LIST) {
    if (unlockedMap.has(ach.id)) continue;
    if (!isAchievementUnlocked(ach, ctx, unlockedMap)) continue;
    const granted = await grantAchievement(userId, ach.id);
    if (granted) newlyUnlocked.push(ach.id);
  }

  return newlyUnlocked;
}

function achievementToPublic(ach, unlockedMap, ctx) {
  const unlocked = unlockedMap.has(ach.id) || (ctx && isAchievementUnlocked(ach, ctx, unlockedMap));
  const progress = ach.type === "goal" && ctx ? achievementProgress(ach, ctx) : null;
  return {
    id: ach.id,
    type: ach.type,
    tier: ach.tier || null,
    name: ach.name,
    description: ach.description,
    iconUrl: achievementIconPath(ach.id),
    unlocked,
    unlockedAt: unlockedMap.get(ach.id)?.unlockedAt || null,
    progress,
  };
}

async function getAchievementsForUser(userId) {
  await syncAchievementsForUser(userId);
  const ctx = await buildAchievementContext(userId);
  const unlockedMap = await getUnlockedMap(userId);
  const achievements = ACHIEVEMENT_LIST.map((ach) =>
    achievementToPublic(ach, unlockedMap, ctx)
  );
  const { rows } = await getPool().query(
    `SELECT displayed_achievements FROM users WHERE id = $1`,
    [userId]
  );
  const displayed = normalizeDisplayedIds(rows[0]?.displayed_achievements, unlockedMap, ctx);
  return { achievements, displayed };
}

function normalizeDisplayedIds(raw, unlockedMap, ctx) {
  let ids = [];
  if (Array.isArray(raw)) ids = raw.filter((id) => typeof id === "string");
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) ids = parsed;
    } catch {
      ids = [];
    }
  }
  return ids
    .filter((id) => ACHIEVEMENTS[id])
    .filter((id) => {
      const ach = ACHIEVEMENTS[id];
      return unlockedMap.has(id) || (ctx && isAchievementUnlocked(ach, ctx, unlockedMap));
    })
    .slice(0, MAX_DISPLAYED_ACHIEVEMENTS);
}

async function getDisplayedAchievementsPublic(userId) {
  await syncAchievementsForUser(userId);
  const ctx = await buildAchievementContext(userId);
  const unlockedMap = await getUnlockedMap(userId);
  const { rows } = await getPool().query(
    `SELECT displayed_achievements FROM users WHERE id = $1`,
    [userId]
  );
  const ids = normalizeDisplayedIds(rows[0]?.displayed_achievements, unlockedMap, ctx);
  return ids.map((id) => {
    const ach = ACHIEVEMENTS[id];
    return {
      id,
      type: ach.type,
      tier: ach.tier || null,
      name: ach.name,
      iconUrl: achievementIconPath(id),
    };
  });
}

async function setDisplayedAchievements(userId, ids) {
  if (!Array.isArray(ids)) {
    return { ok: false, error: "Неверный формат списка достижений." };
  }

  await syncAchievementsForUser(userId);
  const ctx = await buildAchievementContext(userId);
  const unlockedMap = await getUnlockedMap(userId);
  const normalized = normalizeDisplayedIds(ids, unlockedMap, ctx);

  if (ids.length > MAX_DISPLAYED_ACHIEVEMENTS) {
    return {
      ok: false,
      error: `Можно показать не более ${MAX_DISPLAYED_ACHIEVEMENTS} достижений.`,
    };
  }

  for (const id of ids) {
    if (!ACHIEVEMENTS[id]) {
      return { ok: false, error: "Неизвестное достижение." };
    }
    const ach = ACHIEVEMENTS[id];
    if (!unlockedMap.has(id) && !(ctx && isAchievementUnlocked(ach, ctx, unlockedMap))) {
      return { ok: false, error: "Нельзя показать неполученное достижение." };
    }
  }

  await getPool().query(
    `UPDATE users SET displayed_achievements = $2::jsonb WHERE id = $1`,
    [userId, JSON.stringify(normalized)]
  );

  return { ok: true, displayed: normalized };
}

async function getUnlockedCount(userId) {
  await syncAchievementsForUser(userId);
  const ctx = await buildAchievementContext(userId);
  const unlockedMap = await getUnlockedMap(userId);
  return ACHIEVEMENT_LIST.filter(
    (ach) => unlockedMap.has(ach.id) || (ctx && isAchievementUnlocked(ach, ctx, unlockedMap))
  ).length;
}

module.exports = {
  syncAchievementsForUser,
  getAchievementsForUser,
  getDisplayedAchievementsPublic,
  setDisplayedAchievements,
  grantAchievement,
  getUnlockedCount,
  MAX_DISPLAYED_ACHIEVEMENTS,
};
