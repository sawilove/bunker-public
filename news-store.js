const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { getPool } = require("./db");

const NEWS_CATEGORIES = ["dev", "event", "update", "community"];

const CATEGORY_LABELS = {
  dev: "Разработка",
  event: "Событие",
  update: "Обновление",
  community: "Сообщество",
};

function rowToPost(row) {
  if (!row) return null;
  let media = row.media;
  if (typeof media === "string") {
    try {
      media = JSON.parse(media);
    } catch {
      media = [];
    }
  }
  return {
    id: row.id,
    title: row.title,
    body: row.body || "",
    category: row.category || "dev",
    media: Array.isArray(media) ? media : [],
    date: formatDate(row.published_at || row.created_at),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorId: row.author_id,
  };
}

function formatDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

async function seedNewsIfEmpty() {
  const { rows } = await getPool().query(`SELECT 1 FROM news_posts LIMIT 1`);
  if (rows.length > 0) return;
  const jsonPath = path.join(__dirname, "public", "news.json");
  if (!fs.existsSync(jsonPath)) return;
  let items;
  try {
    items = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    return;
  }
  for (const item of items) {
    const id = item.id || crypto.randomBytes(8).toString("hex");
    await getPool().query(
      `INSERT INTO news_posts (id, title, body, category, published_at)
       VALUES ($1, $2, $3, $4, $5::date)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        item.title || "",
        item.body || "",
        item.tag || item.category || "dev",
        item.date || new Date().toISOString().slice(0, 10),
      ]
    );
  }
}

async function listNews(category = null) {
  const params = [];
  let where = "";
  if (category && NEWS_CATEGORIES.includes(category)) {
    params.push(category);
    where = `WHERE category = $1`;
  }
  const { rows } = await getPool().query(
    `SELECT * FROM news_posts ${where} ORDER BY published_at DESC, created_at DESC`,
    params
  );
  return rows.map(rowToPost);
}

async function getNewsPost(id) {
  const { rows } = await getPool().query(`SELECT * FROM news_posts WHERE id = $1`, [
    id,
  ]);
  return rowToPost(rows[0]);
}

async function createNewsPost(authorId, data) {
  const title = (data.title || "").trim().slice(0, 200);
  const body = (data.body || "").trim().slice(0, 20000);
  const category = NEWS_CATEGORIES.includes(data.category)
    ? data.category
    : "dev";
  if (!title) return { ok: false, error: "Укажите заголовок." };
  const id = crypto.randomBytes(8).toString("hex");
  const published = data.date || new Date().toISOString().slice(0, 10);
  let media = Array.isArray(data.media) ? data.media : [];
  media = media.slice(0, 10).map((m) => ({
    id: m.id,
    type: m.type === "video" ? "video" : "image",
    mimeType: m.mimeType || "",
  }));

  const { rows } = await getPool().query(
    `INSERT INTO news_posts (id, title, body, category, media, published_at, author_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::date, $7)
     RETURNING *`,
    [id, title, body, category, JSON.stringify(media), published, authorId]
  );
  return { ok: true, post: rowToPost(rows[0]) };
}

async function updateNewsPost(id, data) {
  const existing = await getNewsPost(id);
  if (!existing) return { ok: false, error: "Новость не найдена." };

  const title = (data.title ?? existing.title).trim().slice(0, 200);
  const body = (data.body ?? existing.body).trim().slice(0, 20000);
  const category = NEWS_CATEGORIES.includes(data.category)
    ? data.category
    : existing.category;
  const published = data.date || existing.date;
  let media = data.media !== undefined ? data.media : existing.media;
  if (!Array.isArray(media)) media = [];
  media = media.slice(0, 10).map((m) => ({
    id: m.id,
    type: m.type === "video" ? "video" : "image",
    mimeType: m.mimeType || "",
  }));

  const { rows } = await getPool().query(
    `UPDATE news_posts
     SET title = $2, body = $3, category = $4, media = $5::jsonb,
         published_at = $6::date, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, title, body, category, JSON.stringify(media), published]
  );
  return { ok: true, post: rowToPost(rows[0]) };
}

async function deleteNewsPost(id) {
  const result = await getPool().query(`DELETE FROM news_posts WHERE id = $1`, [id]);
  return { ok: result.rowCount > 0 };
}

async function saveNewsMedia(buffer, mimeType) {
  const id = crypto.randomBytes(12).toString("hex");
  let out = buffer;
  let outMime = mimeType;

  if (mimeType.startsWith("image/") && mimeType !== "image/webp") {
    try {
      out = await sharp(buffer)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      outMime = "image/webp";
    } catch {
      /* keep original */
    }
  }

  if (out.length > 15 * 1024 * 1024) {
    return { ok: false, error: "Файл больше 15 МБ." };
  }

  await getPool().query(
    `INSERT INTO news_media (id, mime_type, data) VALUES ($1, $2, $3)`,
    [id, outMime, out]
  );

  const type = outMime.startsWith("video/") ? "video" : "image";
  return {
    ok: true,
    media: { id, type, mimeType: outMime, url: `/api/news/media/${id}` },
  };
}

async function getNewsMedia(id) {
  const { rows } = await getPool().query(
    `SELECT mime_type, data FROM news_media WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return { mimeType: rows[0].mime_type, buffer: rows[0].data };
}

module.exports = {
  NEWS_CATEGORIES,
  CATEGORY_LABELS,
  seedNewsIfEmpty,
  listNews,
  getNewsPost,
  createNewsPost,
  updateNewsPost,
  deleteNewsPost,
  saveNewsMedia,
  getNewsMedia,
};
