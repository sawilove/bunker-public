const crypto = require("crypto");
const { getPool } = require("./db");

let emitToUser = null;

function setNotificationEmitter(fn) {
  emitToUser = fn;
}

function rowToNotification(row) {
  if (!row) return null;
  const payload = row.payload || {};
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || "",
    href: row.href || "",
    iconUrl: row.icon_url || "",
    action: payload.action || null,
    at: new Date(row.created_at).getTime(),
    read: !!row.read_at,
    dedupeKey: row.dedupe_key || null,
    payload,
  };
}

async function createNotification(userId, data) {
  const {
    type,
    title,
    body = "",
    href = "",
    iconUrl = "",
    action = null,
    dedupeKey = null,
    payload = {},
  } = data;

  const fullPayload = { ...payload };
  if (action) fullPayload.action = action;

  const id = crypto.randomBytes(12).toString("hex");

  try {
    const { rows } = await getPool().query(
      `INSERT INTO notifications
       (id, user_id, type, title, body, href, icon_url, payload, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING *`,
      [
        id,
        userId,
        type,
        title,
        body,
        href,
        iconUrl,
        JSON.stringify(fullPayload),
        dedupeKey,
      ]
    );
    const notif = rowToNotification(rows[0]);
    if (emitToUser) emitToUser(userId, "notification:new", notif);
    return notif;
  } catch (err) {
    if (err.code === "23505" && dedupeKey) {
      const { rows } = await getPool().query(
        `SELECT * FROM notifications WHERE user_id = $1 AND dedupe_key = $2`,
        [userId, dedupeKey]
      );
      return rowToNotification(rows[0]);
    }
    throw err;
  }
}

async function listNotifications(userId, limit = 50, before = null) {
  const params = [userId];
  let beforeClause = "";
  if (before) {
    params.push(before);
    beforeClause = `AND created_at < $${params.length}::timestamptz`;
  }
  params.push(Math.min(limit, 100));
  const { rows } = await getPool().query(
    `SELECT * FROM notifications
     WHERE user_id = $1 ${beforeClause}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(rowToNotification);
}

async function getUnreadCount(userId) {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS c FROM notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return rows[0]?.c || 0;
}

async function markNotificationRead(userId, notificationId) {
  const { rowCount } = await getPool().query(
    `UPDATE notifications SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [notificationId, userId]
  );
  return rowCount > 0;
}

async function markAllNotificationsRead(userId) {
  await getPool().query(
    `UPDATE notifications SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return { ok: true };
}

async function deleteNotification(userId, notificationId) {
  await getPool().query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
  return { ok: true };
}

async function pushFriendRequestNotification(toUserId, fromUser) {
  return createNotification(toUserId, {
    type: "friend_request",
    title: `${fromUser.nickname || "Игрок"} хочет добавить вас в друзья`,
    body: "Примите или отклоните заявку",
    dedupeKey: `friend_request:${fromUser.id}`,
    action: { userId: fromUser.id },
    payload: { fromUserId: fromUser.id, fromNickname: fromUser.nickname },
  });
}

async function pushSessionInviteNotification(toUserId, data) {
  const href = `/game/${encodeURIComponent(data.code)}`;
  return createNotification(toUserId, {
    type: "session_invite",
    title: `${data.fromNickname || "Игрок"} зовёт в игру`,
    body: `Код сессии: ${data.code}`,
    href,
    dedupeKey: `session_invite:${data.code}:${data.fromUserId}`,
    payload: data,
  });
}

async function pushAchievementUnlockNotification(userId, ach) {
  return createNotification(userId, {
    type: "achievement_unlock",
    title: "Достижение получено",
    body: ach.name,
    href: "/achievements",
    iconUrl: ach.iconUrl || "",
    dedupeKey: `achievement_unlock:${ach.id}`,
    payload: { achievementId: ach.id },
  });
}

async function pushFriendAcceptedNotification(toUserId, accepter) {
  return createNotification(toUserId, {
    type: "friend_accepted",
    title: `${accepter.nickname || "Игрок"} принял заявку в друзья`,
    body: "Теперь вы можете переписываться и приглашать в игру",
    href: "/friends",
    dedupeKey: `friend_accepted:${accepter.id}`,
    payload: { userId: accepter.id },
  });
}

module.exports = {
  setNotificationEmitter,
  createNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  pushFriendRequestNotification,
  pushSessionInviteNotification,
  pushAchievementUnlockNotification,
  pushFriendAcceptedNotification,
};
