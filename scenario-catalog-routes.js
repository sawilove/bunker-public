const scenarioCatalog = require("./scenario-catalog-store");
const { hasPremiumAccess } = require("./user-store");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return "";
}

function mountScenarioCatalogRoutes(app, { verifyToken, requireUser }) {
  app.get("/api/scenarios/catalog", async (req, res) => {
    try {
      const user = await verifyToken(getBearerToken(req));
      if (!user) {
        res.status(401).json({ error: "Войдите в аккаунт." });
        return;
      }
      const sort = scenarioCatalog.sanitizeSort(req.query.sort);
      const scenarios = await scenarioCatalog.listPublished(sort);
      res.json({ scenarios, sort });
    } catch (err) {
      console.error("scenarios catalog list", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/scenarios/catalog/:id/cover", async (req, res) => {
    try {
      const buf = await scenarioCatalog.getCoverBuffer(req.params.id);
      if (!buf) {
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buf);
    } catch (err) {
      console.error("scenario cover", err);
      res.status(500).end();
    }
  });

  app.get("/api/users/:userId/scenarios", async (req, res) => {
    try {
      const { getUserByPublicId } = require("./user-store");
      const user = await getUserByPublicId(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "Игрок не найден." });
        return;
      }
      const sort = scenarioCatalog.sanitizeSort(req.query.sort);
      const scenarios = await scenarioCatalog.listPublishedByAuthor(user.id, sort);
      const publishedCount = await scenarioCatalog.countPublishedByAuthor(user.id);
      res.json({
        author: {
          id: user.id,
          profileId: user.profileId || user.id,
          nickname: user.nickname,
        },
        scenarios,
        publishedCount,
        sort,
      });
    } catch (err) {
      console.error("user scenarios list", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/scenarios/:id/rate", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await scenarioCatalog.rateScenario(
        user.id,
        req.params.id,
        req.body?.rating
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("scenarios rate", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/scenarios/mine", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const scenarios = await scenarioCatalog.listByAuthor(user.id);
      res.json({ scenarios });
    } catch (err) {
      console.error("scenarios mine", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/scenarios", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const existingId = req.body?.id ? String(req.body.id).trim() : null;
      const result = await scenarioCatalog.upsertDraft(user.id, req.body || {}, existingId);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ scenario: result.entry });
    } catch (err) {
      console.error("scenarios upsert", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/scenarios/:id/submit", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const result = await scenarioCatalog.submitForReview(user.id, req.params.id);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ scenario: result.entry });
    } catch (err) {
      console.error("scenarios submit", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.delete("/api/scenarios/:id", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const result = await scenarioCatalog.deleteByAuthor(user.id, req.params.id);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("scenarios delete", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.delete("/api/scenarios/:id/cover", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const result = await scenarioCatalog.clearCoverWebp(user.id, req.params.id);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ scenario: result.entry });
    } catch (err) {
      console.error("scenarios cover clear", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/scenarios/:id/cover", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const processed = await scenarioCatalog.processCoverUpload(
        req.body?.image,
        req.body?.crop
      );
      if (!processed.ok) {
        res.status(400).json({ error: processed.error });
        return;
      }
      const result = await scenarioCatalog.setCoverWebp(
        user.id,
        req.params.id,
        processed.webp
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ scenario: result.entry });
    } catch (err) {
      console.error("scenarios cover", err);
      res.status(500).json({ error: "Не удалось обработать изображение." });
    }
  });

  app.get("/api/dev/scenarios/pending", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!user.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const scenarios = await scenarioCatalog.listPending();
      res.json({ scenarios });
    } catch (err) {
      console.error("dev scenarios pending", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/dev/scenarios/:id/approve", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!user.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const result = await scenarioCatalog.approveScenario(
        user.id,
        req.params.id,
        req.body?.note
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ scenario: result.entry });
    } catch (err) {
      console.error("dev scenarios approve", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/dev/scenarios/:id/reject", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!user.dev) {
        res.status(403).json({ error: "Только для разработчиков." });
        return;
      }
      const result = await scenarioCatalog.rejectScenario(
        user.id,
        req.params.id,
        req.body?.note
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ scenario: result.entry });
    } catch (err) {
      console.error("dev scenarios reject", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });
}

module.exports = { mountScenarioCatalogRoutes };
