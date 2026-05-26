const path = require("path");
const { verifyToken } = require("./user-store");
const { enrichPublicUser } = require("./social-store");
const {
  searchUsersByNickname,
  listFriends,
  sendFriendRequest,
  sendFriendRequestToId,
  respondFriendRequest,
  removeFriend,
  getChatMessages,
  sendChatMessage,
  areFriends,
} = require("./social-store");
const {
  addSocialSocket,
  removeSocialSocket,
  getUserStatus,
} = require("./presence");

let _io = null;

function emitToUser(userId, event, payload) {
  if (_io) _io.to(`user:${userId}`).emit(event, payload);
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

async function requireUser(req, res) {
  const user = await verifyToken(getBearerToken(req));
  if (!user) {
    res.status(401).json({ error: "Требуется вход в аккаунт." });
    return null;
  }
  return user;
}

function mountSocialRoutes(app, io) {
  _io = io;

  app.get("/news", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "news.html"));
  });

  app.get("/friends", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "friends.html"));
  });

  app.get("/api/friends", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const data = await listFriends(user.id);
      res.json(data);
    } catch (err) {
      console.error("friends list error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/users/search", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const users = await searchUsersByNickname(req.query.q, user.id);
      res.json({ users });
    } catch (err) {
      console.error("search error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/friends/request", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = req.body?.userId
        ? await sendFriendRequestToId(user.id, req.body.userId)
        : await sendFriendRequest(user.id, req.body?.nickname);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      if (result.ok && !result.accepted && result.toUserId) {
        emitToUser(result.toUserId, "notification:friend_request", {
          fromUserId: user.id,
          fromNickname: user.nickname,
        });
      }
      res.json(result);
    } catch (err) {
      console.error("friend request error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/friends/respond", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const peerId = req.body?.userId;
      const accept = !!req.body?.accept;
      const result = await respondFriendRequest(user.id, peerId, accept);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("friend respond error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.delete("/api/friends/:peerId", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      await removeFriend(user.id, req.params.peerId);
      res.json({ ok: true });
    } catch (err) {
      console.error("friend remove error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/chat/:peerId", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await getChatMessages(
        user.id,
        req.params.peerId,
        80,
        req.query.before || null
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("chat history error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });
}

function mountSocialSockets(io, deps = {}) {
  const { getSessionInvitePayload } = deps;
  const socialUserBySocket = new Map();

  async function emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  }

  io.on("connection", (socket) => {
    socket.on("social:connect", async (payload) => {
      const token = payload?.token;
      const user = token ? await verifyToken(token) : null;
      if (!user) {
        socket.emit("social:error", { error: "Не авторизован." });
        return;
      }
      const prev = socialUserBySocket.get(socket.id);
      if (prev) {
        removeSocialSocket(prev, socket.id);
        socket.leave(`user:${prev}`);
      }
      socialUserBySocket.set(socket.id, user.id);
      addSocialSocket(user.id, socket.id);
      socket.join(`user:${user.id}`);
      socket.emit("social:connected", {
        user: await enrichPublicUser(user),
      });
      const friends = await listFriends(user.id);
      const notifyIds = new Set([
        ...friends.friends.map((f) => f.id),
        ...friends.incoming.map((f) => f.id),
        ...friends.outgoing.map((f) => f.id),
      ]);
      for (const fid of notifyIds) {
        emitToUser(fid, "friend:presence", {
          userId: user.id,
          status: getUserStatus(user.id),
        });
      }
    });

    socket.on("chat:send", async (payload) => {
      const userId = socialUserBySocket.get(socket.id);
      if (!userId) return;
      const toUserId = payload?.toUserId;
      const result = await sendChatMessage(userId, toUserId, payload?.body);
      if (!result.ok) {
        socket.emit("chat:error", { error: result.error });
        return;
      }
      socket.emit("chat:message", result.message);
      emitToUser(toUserId, "chat:message", {
        ...result.message,
        mine: false,
      });
    });

    socket.on("session:invite", async (payload) => {
      const userId = socialUserBySocket.get(socket.id);
      if (!userId) return;
      const friendId = payload?.friendUserId;
      if (!friendId) return;
      if (!(await areFriends(userId, friendId))) {
        socket.emit("social:error", { error: "Можно приглашать только друзей." });
        return;
      }
      let invite = getSessionInvitePayload?.(userId, socket);
      if (!invite?.code) {
        socket.emit("social:error", { error: invite?.error || "Нет активной сессии." });
        return;
      }
      const invitePayload = {
        code: invite.code,
        fromUserId: userId,
        fromNickname: invite.nickname,
      };
      emitToUser(friendId, "session:invite", invitePayload);
      emitToUser(friendId, "notification:session_invite", invitePayload);
      socket.emit("session:inviteSent", { friendUserId: friendId });
    });

    socket.on("disconnect", () => {
      const userId = socialUserBySocket.get(socket.id);
      if (!userId) return;
      socialUserBySocket.delete(socket.id);
      removeSocialSocket(userId, socket.id);
      if (getUserStatus(userId) === "offline") {
        listFriends(userId).then((data) => {
          const ids = new Set([
            ...data.friends.map((f) => f.id),
            ...data.incoming.map((f) => f.id),
            ...data.outgoing.map((f) => f.id),
          ]);
          for (const fid of ids) {
            emitToUser(fid, "friend:presence", {
              userId,
              status: "offline",
            });
          }
        });
      }
    });
  });
}

module.exports = {
  mountSocialRoutes,
  mountSocialSockets,
  enrichPublicUser,
};
