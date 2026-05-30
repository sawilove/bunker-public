const crypto = require("crypto");
const { getPool } = require("./db");
const { getUserById } = require("./user-store");
const { areFriends } = require("./social-store");
const { isBlockedEither } = require("./moderation-store");

async function listUserGroups(userId) {
  const { rows } = await getPool().query(
    `SELECT g.*, gm.role,
            (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
     FROM group_members gm
     JOIN bunker_groups g ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY g.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    role: r.role,
    memberCount: r.member_count,
    createdAt: r.created_at,
  }));
}

async function createGroup(ownerId, name) {
  const title = (name || "").trim().slice(0, 40);
  if (title.length < 2) return { ok: false, error: "Название отряда: от 2 до 40 символов." };
  const id = crypto.randomBytes(10).toString("hex");
  await getPool().query(
    `INSERT INTO bunker_groups (id, name, owner_id) VALUES ($1, $2, $3)`,
    [id, title, ownerId]
  );
  await getPool().query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [id, ownerId]
  );
  return { ok: true, group: { id, name: title, ownerId, role: "owner", memberCount: 1 } };
}

async function getGroupIfMember(userId, groupId) {
  const { rows } = await getPool().query(
    `SELECT g.*, gm.role FROM bunker_groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2
     WHERE g.id = $1`,
    [groupId, userId]
  );
  return rows[0] || null;
}

async function addGroupMember(actorId, groupId, peerId) {
  const group = await getGroupIfMember(actorId, groupId);
  if (!group) return { ok: false, error: "Отряд не найден." };
  if (group.role !== "owner") {
    return { ok: false, error: "Добавлять участников может только владелец." };
  }
  if (actorId === peerId) return { ok: false, error: "Уже в отряде." };
  if (!(await areFriends(actorId, peerId))) {
    return { ok: false, error: "Можно добавить только друга." };
  }
  if (await isBlockedEither(actorId, peerId)) {
    return { ok: false, error: "Действие недоступно." };
  }
  const peer = await getUserById(peerId);
  if (!peer) return { ok: false, error: "Игрок не найден." };

  const { rowCount } = await getPool().query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT DO NOTHING`,
    [groupId, peerId]
  );
  if (!rowCount) return { ok: false, error: "Игрок уже в отряде." };
  return { ok: true, userId: peerId, nickname: peer.nickname };
}

async function removeGroupMember(actorId, groupId, peerId) {
  const group = await getGroupIfMember(actorId, groupId);
  if (!group) return { ok: false, error: "Отряд не найден." };
  if (peerId === group.owner_id && actorId !== peerId) {
    return { ok: false, error: "Нельзя исключить владельца." };
  }
  if (actorId !== group.owner_id && actorId !== peerId) {
    return { ok: false, error: "Недостаточно прав." };
  }
  await getPool().query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, peerId]
  );
  if (peerId === group.owner_id) {
    await getPool().query(`DELETE FROM bunker_groups WHERE id = $1`, [groupId]);
  }
  return { ok: true };
}

async function listGroupMembers(userId, groupId) {
  const group = await getGroupIfMember(userId, groupId);
  if (!group) return { ok: false, error: "Отряд не найден." };
  const { rows } = await getPool().query(
    `SELECT u.id, u.nickname, u.profile_id, gm.role, gm.joined_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );
  return {
    ok: true,
    group: { id: group.id, name: group.name, ownerId: group.owner_id },
    members: rows.map((r) => ({
      id: r.id,
      profileId: r.profile_id || r.id,
      nickname: r.nickname,
      role: r.role,
      joinedAt: r.joined_at,
    })),
  };
}

async function getGroupMessages(userId, groupId, limit = 50, before = null) {
  const group = await getGroupIfMember(userId, groupId);
  if (!group) return { ok: false, error: "Отряд не найден." };
  const params = [groupId];
  let timeClause = "";
  if (before) {
    params.push(before);
    timeClause = `AND created_at < $${params.length}`;
  }
  params.push(Math.min(limit, 100));
  const { rows } = await getPool().query(
    `SELECT id, group_id, from_user_id, body, created_at
     FROM group_messages
     WHERE group_id = $1 ${timeClause}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return {
    ok: true,
    messages: rows.reverse().map((r) => ({
      id: r.id,
      groupId: r.group_id,
      fromUserId: r.from_user_id,
      body: r.body,
      createdAt: r.created_at,
      mine: r.from_user_id === userId,
    })),
  };
}

async function sendGroupMessage(fromUserId, groupId, body) {
  const text = (body || "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Пустое сообщение." };
  const group = await getGroupIfMember(fromUserId, groupId);
  if (!group) return { ok: false, error: "Отряд не найден." };
  const id = crypto.randomBytes(12).toString("hex");
  const { rows } = await getPool().query(
    `INSERT INTO group_messages (id, group_id, from_user_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, group_id, from_user_id, body, created_at`,
    [id, groupId, fromUserId, text]
  );
  const r = rows[0];
  return {
    ok: true,
    message: {
      id: r.id,
      groupId: r.group_id,
      fromUserId: r.from_user_id,
      body: r.body,
      createdAt: r.created_at,
      mine: true,
    },
  };
}

async function listGroupMemberIds(groupId) {
  const { rows } = await getPool().query(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [groupId]
  );
  return rows.map((r) => r.user_id);
}

module.exports = {
  listUserGroups,
  createGroup,
  getGroupIfMember,
  addGroupMember,
  removeGroupMember,
  listGroupMembers,
  getGroupMessages,
  sendGroupMessage,
  listGroupMemberIds,
};
