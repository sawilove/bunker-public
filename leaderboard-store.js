const { getPool } = require("./db");

const VALID_METRICS = ["survivals", "games", "scenarios"];
const VALID_SCOPES = ["global", "friends"];

function metricColumn(metric) {
  if (metric === "games") return "games_played";
  if (metric === "scenarios") return null;
  return "bunker_survivals";
}

async function getLeaderboard({ metric = "survivals", scope = "global", userId = null, limit = 50 }) {
  const m = VALID_METRICS.includes(metric) ? metric : "survivals";
  const s = VALID_SCOPES.includes(scope) ? scope : "global";
  const cap = Math.min(Math.max(1, limit), 100);

  if (m === "scenarios") {
    let friendClause = "";
    const params = [cap];
    if (s === "friends" && userId) {
      params.unshift(userId);
      friendClause = `AND sc.author_id IN (
        SELECT CASE WHEN fp.user_a = $1 THEN fp.user_b ELSE fp.user_a END
        FROM friend_pairs fp
        WHERE (fp.user_a = $1 OR fp.user_b = $1) AND fp.status = 'accepted'
        UNION SELECT $1
      )`;
    }
    const { rows } = await getPool().query(
      `SELECT u.id, u.nickname, u.profile_id, u.avatar_updated_at,
              COUNT(sc.id)::int AS score
       FROM scenario_catalog sc
       JOIN users u ON u.id = sc.author_id
       WHERE sc.status = 'published' ${friendClause}
       GROUP BY u.id
       ORDER BY score DESC, u.nickname ASC
       LIMIT $${params.length}`,
      params
    );
    return formatRows(rows, "scenarios");
  }

  const col = metricColumn(m);
  let friendJoin = "";
  const params = [cap];
  if (s === "friends" && userId) {
    params.unshift(userId);
    friendJoin = `AND u.id IN (
      SELECT CASE WHEN fp.user_a = $1 THEN fp.user_b ELSE fp.user_a END
      FROM friend_pairs fp
      WHERE (fp.user_a = $1 OR fp.user_b = $1) AND fp.status = 'accepted'
      UNION SELECT $1
    )`;
  }

  const { rows } = await getPool().query(
    `SELECT u.id, u.nickname, u.profile_id, u.avatar_updated_at,
            u.${col} AS score, u.games_played, u.bunker_survivals
     FROM users u
     WHERE u.${col} > 0 ${friendJoin}
     ORDER BY u.${col} DESC, u.nickname ASC
     LIMIT $${params.length}`,
    params
  );
  return formatRows(rows, m);
}

function formatRows(rows, metric) {
  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id,
    profileId: row.profile_id || row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_updated_at ? `/api/avatars/${row.id}` : null,
    score: Number(row.score) || 0,
    metric,
    gamesPlayed: row.games_played || 0,
    bunkerSurvivals: row.bunker_survivals || 0,
  }));
}

async function getUserRank(userId, metric = "survivals", scope = "global") {
  const board = await getLeaderboard({ metric, scope, userId, limit: 500 });
  const idx = board.findIndex((e) => e.userId === userId);
  if (idx === -1) return null;
  return board[idx];
}

async function getSurvivalRankInfo(userId) {
  const p = getPool();
  const { rows: userRows } = await p.query(
    `SELECT bunker_survivals, nickname_lower FROM users WHERE id = $1`,
    [userId]
  );
  const user = userRows[0];
  if (!user || user.bunker_survivals <= 0) return null;

  const [{ rows: rankRows }, { rows: totalRows }] = await Promise.all([
    p.query(
      `SELECT COUNT(*)::int + 1 AS rank FROM users u
       WHERE u.bunker_survivals > $1
          OR (u.bunker_survivals = $1 AND u.nickname_lower < $2)`,
      [user.bunker_survivals, user.nickname_lower]
    ),
    p.query(`SELECT COUNT(*)::int AS total FROM users WHERE bunker_survivals > 0`),
  ]);

  return {
    rank: rankRows[0]?.rank || null,
    total: totalRows[0]?.total || 0,
    metric: "survivals",
  };
}

module.exports = {
  VALID_METRICS,
  VALID_SCOPES,
  getLeaderboard,
  getUserRank,
  getSurvivalRankInfo,
};
