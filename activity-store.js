const crypto = require("crypto");
const { getPool } = require("./db");

const PUBLIC_TYPES = new Set([
  "achievement_unlock",
  "scenario_published",
  "survival_milestone",
]);

async function recordActivity(userId, type, payload = {}) {
  if (!userId || !type) return null;
  const id = crypto.randomBytes(12).toString("hex");
  await getPool().query(
    `INSERT INTO activity_events (id, user_id, type, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [id, userId, type, JSON.stringify(payload)]
  );
  return id;
}

const GLOBAL_TYPES = ["scenario_published", "survival_milestone"];
const FRIENDS_TYPES = [...PUBLIC_TYPES];

async function listActivity({ scope = "global", userId = null, limit = 30, before = null }) {
  const cap = Math.min(Math.max(1, limit), 50);
  const params = [];
  let where = "WHERE ae.type = ANY($1::text[])";
  params.push(scope === "friends" ? FRIENDS_TYPES : GLOBAL_TYPES);

  if (scope === "friends" && userId) {
    params.push(userId);
    where += ` AND ae.user_id IN (
      SELECT CASE WHEN fp.user_a = $${params.length} THEN fp.user_b ELSE fp.user_a END
      FROM friend_pairs fp
      WHERE (fp.user_a = $${params.length} OR fp.user_b = $${params.length}) AND fp.status = 'accepted'
      UNION SELECT $${params.length}
    )`;
  }

  where += ` AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = ae.user_id AND u.activity_hidden = true
  )`;

  if (before) {
    params.push(before);
    where += ` AND ae.created_at < $${params.length}::timestamptz`;
  }

  params.push(cap);
  const { rows } = await getPool().query(
    `SELECT ae.*, u.nickname, u.profile_id
     FROM activity_events ae
     JOIN users u ON u.id = ae.user_id
     ${where}
     ORDER BY ae.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    payload: row.payload || {},
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      profileId: row.profile_id || row.user_id,
      nickname: row.nickname,
    },
  }));
}

async function recordAchievementActivity(userId, achievementId, name) {
  return recordActivity(userId, "achievement_unlock", { achievementId, name });
}

async function recordScenarioPublishedActivity(userId, scenarioId, title) {
  return recordActivity(userId, "scenario_published", { scenarioId, title });
}

async function recordSurvivalMilestone(userId, totalSurvivals) {
  const milestones = [5, 10, 20, 50, 100];
  if (!milestones.includes(totalSurvivals)) return null;
  return recordActivity(userId, "survival_milestone", { totalSurvivals });
}

module.exports = {
  recordActivity,
  listActivity,
  recordAchievementActivity,
  recordScenarioPublishedActivity,
  recordSurvivalMilestone,
};
