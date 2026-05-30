const path = require("path");
const { requireUser } = require("./auth-routes");
const {
  setNotificationEmitter,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} = require("./notification-store");
const {
  blockUser,
  unblockUser,
  listBlockedUsers,
  reportUser,
  listPendingReports,
  resolveReport,
  VALID_REASONS,
} = require("./moderation-store");
const { processPaymentWebhook, listPayments, manualGrantPremium } = require("./payment-store");
const { getLeaderboard, getUserRank, VALID_METRICS, VALID_SCOPES } = require("./leaderboard-store");
const { listActivity } = require("./activity-store");
const {
  listUserGroups,
  createGroup,
  addGroupMember,
  removeGroupMember,
  listGroupMembers,
  getGroupMessages,
} = require("./group-store");
const { setLookingForGame, getLookingForGame } = require("./presence");

function mountSocialPlatformRoutes(app, io) {
  setNotificationEmitter((userId, event, payload) => {
    if (io) io.to(`user:${userId}`).emit(event, payload);
  });

  app.get("/leaderboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "leaderboard.html"));
  });

  app.get("/api/notifications", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const items = await listNotifications(
        user.id,
        Number(req.query.limit) || 50,
        req.query.before || null
      );
      const unread = await getUnreadCount(user.id);
      res.json({ notifications: items, unread });
    } catch (err) {
      console.error("notifications list", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      await markNotificationRead(user.id, req.params.id);
      res.json({ ok: true, unread: await getUnreadCount(user.id) });
    } catch (err) {
      console.error("notification read", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      await markAllNotificationsRead(user.id);
      res.json({ ok: true, unread: 0 });
    } catch (err) {
      console.error("notifications read-all", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      await deleteNotification(user.id, req.params.id);
      res.json({ ok: true, unread: await getUnreadCount(user.id) });
    } catch (err) {
      console.error("notification delete", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/users/:userId/block", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await blockUser(user.id, req.params.userId);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("block user", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.delete("/api/users/:userId/block", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      await unblockUser(user.id, req.params.userId);
      res.json({ ok: true });
    } catch (err) {
      console.error("unblock user", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/blocks", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const blocked = await listBlockedUsers(user.id);
      res.json({ blocked });
    } catch (err) {
      console.error("blocks list", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/users/:userId/report", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await reportUser(user.id, req.params.userId, req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true, reportId: result.reportId });
    } catch (err) {
      console.error("report user", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/dev/reports", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!user.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const reports = await listPendingReports();
      res.json({ reports, reasons: VALID_REASONS });
    } catch (err) {
      console.error("dev reports", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/dev/reports/:id/resolve", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!user.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const result = await resolveReport(
        req.params.id,
        user.id,
        req.body?.dismiss ? "dismissed" : "resolved"
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("dev report resolve", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/webhooks/cloudtips", async (req, res) => {
    try {
      const secret = (process.env.CLOUDTIPS_WEBHOOK_SECRET || "").trim();
      if (secret) {
        const header = req.headers["x-webhook-secret"] || req.headers["x-cloudtips-secret"];
        if (header !== secret) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }
      const body = req.body || {};
      const externalId =
        body.id || body.paymentId || body.transaction_id || body.transactionId;
      const amount = body.amount || body.sum || body.payment_amount || 0;
      const comment =
        body.comment || body.message || body.description || body.payment_comment || "";
      const result = await processPaymentWebhook({ externalId, amount, comment });
      if (!result.ok) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("cloudtips webhook", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/dev/payments", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!user.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const payments = await listPayments();
      res.json({ payments });
    } catch (err) {
      console.error("dev payments", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/dev/premium/grant", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!user.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const result = await manualGrantPremium(
        user.id,
        req.body?.userId,
        req.body?.days || 30
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("dev premium grant", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const metric = VALID_METRICS.includes(req.query.metric) ? req.query.metric : "survivals";
      const scope = VALID_SCOPES.includes(req.query.scope) ? req.query.scope : "global";
      const entries = await getLeaderboard({
        metric,
        scope,
        userId: user.id,
        limit: Number(req.query.limit) || 50,
      });
      const me = await getUserRank(user.id, metric, scope);
      res.json({ metric, scope, entries, me });
    } catch (err) {
      console.error("leaderboard", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/activity", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const scope = req.query.scope === "friends" ? "friends" : "global";
      const events = await listActivity({
        scope,
        userId: user.id,
        limit: Number(req.query.limit) || 30,
        before: req.query.before || null,
      });
      res.json({ scope, events });
    } catch (err) {
      console.error("activity", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.patch("/api/social/lfg", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const enabled = !!req.body?.enabled;
      setLookingForGame(user.id, enabled);
      if (io) {
        const { listFriends } = require("./social-store");
        const { getUserStatus } = require("./presence");
        const data = await listFriends(user.id);
        const ids = new Set(data.friends.map((f) => f.id));
        for (const fid of ids) {
          io.to(`user:${fid}`).emit("friend:presence", {
            userId: user.id,
            status: getUserStatus(user.id),
            lookingForGame: getLookingForGame(user.id),
          });
        }
      }
      res.json({ ok: true, lookingForGame: getLookingForGame(user.id) });
    } catch (err) {
      console.error("lfg", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/groups", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const groups = await listUserGroups(user.id);
      res.json({ groups });
    } catch (err) {
      console.error("groups list", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/groups", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await createGroup(user.id, req.body?.name);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("groups create", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/groups/:groupId/members", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await listGroupMembers(user.id, req.params.groupId);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("group members", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/groups/:groupId/members", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await addGroupMember(user.id, req.params.groupId, req.body?.userId);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("group add member", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.delete("/api/groups/:groupId/members/:peerId", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await removeGroupMember(user.id, req.params.groupId, req.params.peerId);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("group remove member", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/groups/:groupId/messages", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await getGroupMessages(
        user.id,
        req.params.groupId,
        Number(req.query.limit) || 50,
        req.query.before || null
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("group messages", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });
}

module.exports = { mountSocialPlatformRoutes };
