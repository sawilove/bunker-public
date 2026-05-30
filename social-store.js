const crypto = require("crypto");
const { getPool, pairKey, rowToUser } = require("./db");
const { getUserById, publicUser } = require("./user-store");
const { getUserStatus, getLookingForGame } = require("./presence");
const { isBlockedEither, blockedUserFilterSql } = require("./moderation-store");

async function enrichPublicUser(user) {
  if (!user) return null;
  const pub = publicUser(user);
  pub.status = getUserStatus(user.id);
  pub.lookingForGame = getLookingForGame(user.id);
  return pub;
}

async function searchUsersByNickname(query, excludeUserId, limit = 10) {
  const q = (query || "").trim().toLowerCase();
  if (q.length < 1) return [];
  const { rows } = await getPool().query(
    `SELECT * FROM users u
     WHERE nickname_lower LIKE $1 AND id <> $2
       AND ${blockedUserFilterSql(3, "u")}
     ORDER BY
       CASE WHEN nickname_lower LIKE $4 THEN 0 ELSE 1 END,
       nickname_lower
     LIMIT $5`,
    [`%${q}%`, excludeUserId, excludeUserId, `${q}%`, limit]
  );
  const users = [];
  for (const row of rows) {
    users.push(await enrichPublicUser(rowToUser(row)));
  }
  return users;
}

async function listFriends(userId) {
  const { rows } = await getPool().query(
    `SELECT u.*, fp.status, fp.requested_by
     FROM friend_pairs fp
     JOIN users u ON u.id = CASE WHEN fp.user_a = $1 THEN fp.user_b ELSE fp.user_a END
     WHERE fp.user_a = $1 OR fp.user_b = $1
     ORDER BY fp.created_at DESC`,
    [userId]
  );
  const friends = [];
  const incoming = [];
  const outgoing = [];

  for (const row of rows) {
    const peer = rowToUser(row);
    const item = {
      ...(await enrichPublicUser(peer)),
      friendshipStatus: row.status,
      requestedBy: row.requested_by,
      isIncoming: row.status === "pending" && row.requested_by !== userId,
      isOutgoing: row.status === "pending" && row.requested_by === userId,
    };
    if (row.status === "accepted") friends.push(item);
    else if (item.isIncoming) incoming.push(item);
    else outgoing.push(item);
  }

  return { friends, incoming, outgoing };
}

async function getFriendship(viewerId, profileUserId) {
  if (!viewerId || !profileUserId) return "none";
  if (viewerId === profileUserId) return "self";
  const [userA, userB] = pairKey(viewerId, profileUserId);
  const { rows } = await getPool().query(
    `SELECT status, requested_by FROM friend_pairs WHERE user_a = $1 AND user_b = $2`,
    [userA, userB]
  );
  const row = rows[0];
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  if (row.status === "pending") {
    return row.requested_by === viewerId ? "outgoing" : "incoming";
  }
  return "none";
}

async function sendFriendRequest(fromUserId, nickname) {
  const { rows } = await getPool().query(
    `SELECT id FROM users WHERE nickname_lower = $1`,
    [(nickname || "").trim().toLowerCase()]
  );
  if (!rows[0]) return { ok: false, error: "Игрок не найден." };
  return sendFriendRequestToId(fromUserId, rows[0].id);
}

async function sendFriendRequestToId(fromUserId, toUserId) {
  if (fromUserId === toUserId) {
    return { ok: false, error: "Нельзя добавить себя." };
  }
  if (await isBlockedEither(fromUserId, toUserId)) {
    return { ok: false, error: "Действие недоступно." };
  }
  const [userA, userB] = pairKey(fromUserId, toUserId);
  const existing = await getPool().query(
    `SELECT status, requested_by FROM friend_pairs WHERE user_a = $1 AND user_b = $2`,
    [userA, userB]
  );
  const row = existing.rows[0];
  if (row) {
    if (row.status === "accepted") {
      return { ok: false, error: "Вы уже друзья." };
    }
    if (row.requested_by === fromUserId) {
      return { ok: false, error: "Заявка уже отправлена." };
    }
    await getPool().query(
      `UPDATE friend_pairs SET status = 'accepted', requested_by = $3
       WHERE user_a = $1 AND user_b = $2`,
      [userA, userB, fromUserId]
    );
    return { ok: true, accepted: true };
  }
  await getPool().query(
    `INSERT INTO friend_pairs (user_a, user_b, status, requested_by)
     VALUES ($1, $2, 'pending', $3)`,
    [userA, userB, fromUserId]
  );
  return { ok: true, accepted: false, toUserId, fromUserId };
}

async function respondFriendRequest(userId, peerId, accept) {
  const [userA, userB] = pairKey(userId, peerId);
  const { rows } = await getPool().query(
    `SELECT status, requested_by FROM friend_pairs WHERE user_a = $1 AND user_b = $2`,
    [userA, userB]
  );
  const row = rows[0];
  if (!row || row.status !== "pending" || row.requested_by === userId) {
    return { ok: false, error: "Заявки нет." };
  }
  if (!accept) {
    await getPool().query(
      `DELETE FROM friend_pairs WHERE user_a = $1 AND user_b = $2`,
      [userA, userB]
    );
    return { ok: true, accepted: false };
  }
  await getPool().query(
    `UPDATE friend_pairs SET status = 'accepted' WHERE user_a = $1 AND user_b = $2`,
    [userA, userB]
  );
  const { syncAchievementsForUser } = require("./achievement-store");
  syncAchievementsForUser(userId).catch(() => {});
  syncAchievementsForUser(peerId).catch(() => {});
  return { ok: true, accepted: true, requesterId: row.requested_by };
}

async function removeFriend(userId, peerId) {
  const [userA, userB] = pairKey(userId, peerId);
  await getPool().query(
    `DELETE FROM friend_pairs WHERE user_a = $1 AND user_b = $2`,
    [userA, userB]
  );
  return { ok: true };
}

async function areFriends(userId, peerId) {
  const [userA, userB] = pairKey(userId, peerId);
  const { rows } = await getPool().query(
    `SELECT 1 FROM friend_pairs
     WHERE user_a = $1 AND user_b = $2 AND status = 'accepted'`,
    [userA, userB]
  );
  return rows.length > 0;
}

const CHAT_RETENTION_HOURS = 48;

async function purgeOldChatMessages() {
  await getPool().query(
    `DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '48 hours'`
  );
}

async function getChatMessages(userId, peerId, limit = 50, before = null) {
  if (!(await areFriends(userId, peerId))) {
    return { ok: false, error: "Можно писать только друзьям." };
  }
  const params = [userId, peerId];
  let timeClause = "";
  if (before) {
    params.push(before);
    timeClause = `AND created_at < $${params.length}`;
  }
  params.push(limit);
  const { rows } = await getPool().query(
    `SELECT id, from_user_id, to_user_id, body, created_at
     FROM chat_messages
     WHERE (
       (from_user_id = $1 AND to_user_id = $2)
       OR (from_user_id = $2 AND to_user_id = $1)
     )
     AND created_at > NOW() - INTERVAL '${CHAT_RETENTION_HOURS} hours'
     ${timeClause}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return {
    ok: true,
    messages: rows.reverse().map((r) => ({
      id: r.id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      body: r.body,
      createdAt: r.created_at,
      mine: r.from_user_id === userId,
    })),
  };
}

async function sendChatMessage(fromUserId, toUserId, body) {
  const text = (body || "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Пустое сообщение." };
  if (await isBlockedEither(fromUserId, toUserId)) {
    return { ok: false, error: "Действие недоступно." };
  }
  if (!(await areFriends(fromUserId, toUserId))) {
    return { ok: false, error: "Можно писать только друзьям." };
  }
  const id = crypto.randomBytes(12).toString("hex");
  const { rows } = await getPool().query(
    `INSERT INTO chat_messages (id, from_user_id, to_user_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, from_user_id, to_user_id, body, created_at`,
    [id, fromUserId, toUserId, text]
  );
  const r = rows[0];
  return {
    ok: true,
    message: {
      id: r.id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      body: r.body,
      createdAt: r.created_at,
      mine: true,
    },
  };
}

module.exports = {
  enrichPublicUser,
  searchUsersByNickname,
  listFriends,
  getFriendship,
  sendFriendRequest,
  sendFriendRequestToId,
  respondFriendRequest,
  removeFriend,
  areFriends,
  getChatMessages,
  sendChatMessage,
  purgeOldChatMessages,
  CHAT_RETENTION_HOURS,
};
