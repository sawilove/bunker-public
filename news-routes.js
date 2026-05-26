const { verifyToken } = require("./user-store");
const {
  NEWS_CATEGORIES,
  CATEGORY_LABELS,
  listNews,
  getNewsPost,
  createNewsPost,
  updateNewsPost,
  deleteNewsPost,
  saveNewsMedia,
  getNewsMedia,
} = require("./news-store");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

async function requireDev(req, res) {
  const user = await verifyToken(getBearerToken(req));
  if (!user?.dev) {
    res.status(403).json({ error: "Доступ только для разработчиков." });
    return null;
  }
  return user;
}

function mountNewsRoutes(app) {
  app.get("/api/news/categories", (req, res) => {
    res.json({
      categories: NEWS_CATEGORIES.map((id) => ({
        id,
        label: CATEGORY_LABELS[id] || id,
      })),
    });
  });

  app.get("/api/news", async (req, res) => {
    try {
      const category = req.query.category || null;
      const posts = await listNews(category);
      res.json({ posts });
    } catch (err) {
      console.error("news list error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/news/media/:mediaId", async (req, res) => {
    try {
      const media = await getNewsMedia(req.params.mediaId);
      if (!media) {
        res.status(404).end();
        return;
      }
      res.set("Cache-Control", "public, max-age=86400");
      res.type(media.mimeType).send(media.buffer);
    } catch (err) {
      console.error("news media get", err);
      res.status(500).end();
    }
  });

  app.get("/api/news/:id", async (req, res) => {
    try {
      const post = await getNewsPost(req.params.id);
      if (!post) {
        res.status(404).json({ error: "Не найдено." });
        return;
      }
      res.json({ post });
    } catch (err) {
      console.error("news get error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/news", async (req, res) => {
    try {
      const user = await requireDev(req, res);
      if (!user) return;
      const result = await createNewsPost(user.id, req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("news create error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.patch("/api/news/:id", async (req, res) => {
    try {
      const user = await requireDev(req, res);
      if (!user) return;
      const result = await updateNewsPost(req.params.id, req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("news update error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.delete("/api/news/:id", async (req, res) => {
    try {
      const user = await requireDev(req, res);
      if (!user) return;
      const result = await deleteNewsPost(req.params.id);
      if (!result.ok) {
        res.status(404).json({ error: "Не найдено." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("news delete error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/news/media", async (req, res) => {
    try {
      const user = await requireDev(req, res);
      if (!user) return;

      const { file, mimeType } = req.body || {};
      if (!file || typeof file !== "string") {
        res.status(400).json({ error: "Нет файла." });
        return;
      }

      const match = file.match(/^data:([^;]+);base64,(.+)$/i);
      if (!match) {
        res.status(400).json({ error: "Неверный формат файла." });
        return;
      }

      const mime = mimeType || match[1];
      if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
        res.status(400).json({ error: "Только изображения и видео." });
        return;
      }

      const buffer = Buffer.from(match[2], "base64");
      const result = await saveNewsMedia(buffer, mime);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("news media upload", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });
}

module.exports = { mountNewsRoutes };
