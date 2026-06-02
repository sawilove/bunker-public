const path = require("path");
const {
  getAchievementsForUser,
  getDisplayedAchievementsPublic,
  setDisplayedAchievements,
  syncAndGetNewUnlocks,
  grantAchievement,
  revokeAchievement,
} = require("./achievement-store");
const { requireUser } = require("./auth-routes");

function mountAchievementRoutes(app) {
  const publicDir = path.join(__dirname, "public");

  app.get("/achievements", (req, res) => {
    res.sendFile(path.join(publicDir, "achievements.html"));
  });

  app.get("/api/achievements", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const data = await getAchievementsForUser(user.id);
      res.json(data);
    } catch (err) {
      console.error("achievements list error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/achievements/unlocks", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const newlyUnlocked = await syncAndGetNewUnlocks(user.id);
      res.json({ newlyUnlocked });
    } catch (err) {
      console.error("achievements unlocks error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.patch("/api/auth/achievements/display", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await setDisplayedAchievements(user.id, req.body?.displayed);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      const displayed = await getDisplayedAchievementsPublic(user.id);
      res.json({ ok: true, displayed, displayedIds: result.displayed });
    } catch (err) {
      console.error("achievements display error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/users/:userId/achievements/displayed", async (req, res) => {
    try {
      const { getUserByPublicId } = require("./user-store");
      const user = await getUserByPublicId(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "Игрок не найден." });
        return;
      }
      const displayed = await getDisplayedAchievementsPublic(user.id);
      res.json({ displayed });
    } catch (err) {
      console.error("displayed achievements error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/dev/achievements/grant", async (req, res) => {
    try {
      const devUser = await requireUser(req, res);
      if (!devUser) return;
      if (!devUser.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const userId = String(req.body?.userId || "").trim();
      const achievementId = String(req.body?.achievementId || "").trim();
      if (!userId || !achievementId) {
        res.status(400).json({ error: "Укажите userId и achievementId." });
        return;
      }
      const ok = await grantAchievement(userId, achievementId);
      if (!ok) {
        res.status(400).json({ error: "Не удалось выдать достижение." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("dev grant achievement error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/dev/achievements/revoke", async (req, res) => {
    try {
      const devUser = await requireUser(req, res);
      if (!devUser) return;
      if (!devUser.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const userId = String(req.body?.userId || "").trim();
      const achievementId = String(req.body?.achievementId || "").trim();
      if (!userId || !achievementId) {
        res.status(400).json({ error: "Укажите userId и achievementId." });
        return;
      }
      const ok = await revokeAchievement(userId, achievementId);
      if (!ok) {
        res.status(400).json({ error: "Не удалось удалить достижение." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("dev revoke achievement error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });
}

module.exports = { mountAchievementRoutes };
