const path = require("path");
const {
  getAchievementsForUser,
  getDisplayedAchievementsPublic,
  setDisplayedAchievements,
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
}

module.exports = { mountAchievementRoutes };
