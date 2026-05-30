const crypto = require("crypto");
const { getPool } = require("./db");
const { getUserById } = require("./user-store");

const VALID_REASONS = ["spam", "harassment", "inappropriate", "other"];

async function isBlockedEither(userA, userB) {
  if (!userA || !userB || userA === userB) return false;
  const { rows } = await getPool().query(
    `SELECT 1 FROM user_blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

async function isBlockedBy(blockerId, blockedId) {
  const { rows } = await getPool().query(
    `SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  return rows.length > 0;
}

async function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) {
    return { ok: false, error: "Нельзя заблокировать себя." };
  }
  const target = await getUserById(blockedId);
  if (!target) return { ok: false, error: "Игрок не найден." };
  await getPool().query(
    `INSERT INTO user_blocks (blocker_id, blocked_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [blockerId, blockedId]
  );
  const { removeFriend } = require("./social-store");
  await removeFriend(blockerId, blockedId);
  return { ok: true };
}

async function unblockUser(blockerId, blockedId) {
  await getPool().query(
    `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  return { ok: true };
}

async function listBlockedUsers(blockerId) {
  const { rows } = await getPool().query(
    `SELECT u.id, u.nickname, u.profile_id, ub.created_at
     FROM user_blocks ub
     JOIN users u ON u.id = ub.blocked_id
     WHERE ub.blocker_id = $1
     ORDER BY ub.created_at DESC`,
    [blockerId]
  );
  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id || r.id,
    nickname: r.nickname,
    blockedAt: r.created_at,
  }));
}

async function reportUser(reporterId, targetId, { reason, body }) {
  if (reporterId === targetId) {
    return { ok: false, error: "Нельзя пожаловаться на себя." };
  }
  const target = await getUserById(targetId);
  if (!target) return { ok: false, error: "Игрок не найден." };
  const r = VALID_REASONS.includes(reason) ? reason : "other";
  const text = (body || "").trim().slice(0, 1000);
  if (!text) return { ok: false, error: "Опишите проблему." };

  const id = crypto.randomBytes(12).toString("hex");
  await getPool().query(
    `INSERT INTO user_reports (id, reporter_id, target_id, reason, body)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, reporterId, targetId, r, text]
  );
  return { ok: true, reportId: id };
}

async function listPendingReports(limit = 50) {
  const { rows } = await getPool().query(
    `SELECT r.*,
            rep.nickname AS reporter_nickname,
            tgt.nickname AS target_nickname
     FROM user_reports r
     JOIN users rep ON rep.id = r.reporter_id
     JOIN users tgt ON tgt.id = r.target_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at ASC
     LIMIT $1`,
    [Math.min(limit, 100)]
  );
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    reporter: { id: row.reporter_id, nickname: row.reporter_nickname },
    target: { id: row.target_id, nickname: row.target_nickname },
  }));
}

async function resolveReport(reportId, resolverId, status) {
  const next = status === "dismissed" ? "dismissed" : "resolved";
  const { rowCount } = await getPool().query(
    `UPDATE user_reports
     SET status = $3, resolved_by = $2, resolved_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [reportId, resolverId, next]
  );
  if (!rowCount) return { ok: false, error: "Жалоба не найдена или уже обработана." };
  return { ok: true };
}

function blockedUserFilterSql(viewerParam, alias = "u") {
  return `NOT EXISTS (
    SELECT 1 FROM user_blocks ub
    WHERE (ub.blocker_id = $${viewerParam} AND ub.blocked_id = ${alias}.id)
       OR (ub.blocker_id = ${alias}.id AND ub.blocked_id = $${viewerParam})
  )`;
}

module.exports = {
  VALID_REASONS,
  isBlockedEither,
  isBlockedBy,
  blockUser,
  unblockUser,
  listBlockedUsers,
  reportUser,
  listPendingReports,
  resolveReport,
  blockedUserFilterSql,
};
