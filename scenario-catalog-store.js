const crypto = require("crypto");
const sharp = require("sharp");
const { getPool } = require("./db");
const gameData = require("./game-data");

const CATALOG_PREFIX = "catalog:";
const VALID_SCENES = [
  "scene0",
  "scene1",
  "scene2",
  "scene3",
  "scene4",
  "scene5",
  "scene6",
  "scene7",
  "scene8",
];
const VALID_PRESETS = ["standard", "18plus", "custom"];
const VALID_STATUSES = ["draft", "pending", "published", "rejected"];
const VALID_SORTS = ["relevance", "rating", "plays", "newest", "oldest"];

let publishedCache = [];

function sanitizeSort(raw) {
  const s = raw ? String(raw).trim().toLowerCase() : "relevance";
  return VALID_SORTS.includes(s) ? s : "relevance";
}

function ratingAvgFromRow(row) {
  const count = Number(row?.rating_count) || 0;
  if (!count) return null;
  const sum = Number(row?.rating_sum) || 0;
  return Math.round((sum / count) * 10) / 10;
}

function attachRatingFields(entry) {
  entry.ratingSum = Number(entry.ratingSum) || 0;
  entry.ratingCount = Number(entry.ratingCount) || 0;
  entry.ratingAvg =
    entry.ratingCount > 0
      ? Math.round((entry.ratingSum / entry.ratingCount) * 10) / 10
      : null;
  return entry;
}

function publishedTimestamp(entry) {
  const t = entry.publishedAt || entry.reviewedAt || entry.updatedAt;
  if (!t) return 0;
  return new Date(t).getTime() || 0;
}

function relevanceScore(entry) {
  const plays = entry.playCount || 0;
  const avg = entry.ratingAvg || 0;
  const votes = entry.ratingCount || 0;
  const ageMs = Date.now() - publishedTimestamp(entry);
  const days = Math.max(0, ageMs / (86400000));
  const recency = Math.exp(-days / 60);
  const ratingPart = votes > 0 ? avg * Math.log1p(votes) : 0;
  return Math.log1p(plays) * 1.4 + ratingPart * 0.9 + recency * 2.5;
}

function sortPublishedEntries(entries, sortRaw) {
  const sort = sanitizeSort(sortRaw);
  const list = [...entries].map((e) => attachRatingFields({ ...e }));
  list.sort((a, b) => {
    if (sort === "rating") {
      const avgDiff = (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if (avgDiff !== 0) return avgDiff;
      return (b.ratingCount || 0) - (a.ratingCount || 0);
    }
    if (sort === "plays") {
      return (b.playCount || 0) - (a.playCount || 0);
    }
    if (sort === "newest") {
      return publishedTimestamp(b) - publishedTimestamp(a);
    }
    if (sort === "oldest") {
      return publishedTimestamp(a) - publishedTimestamp(b);
    }
    return relevanceScore(b) - relevanceScore(a);
  });
  return list;
}

function catalogBackstoryId(rowId) {
  return `${CATALOG_PREFIX}${rowId}`;
}

function parseCatalogUuid(backstoryId) {
  if (!backstoryId || !String(backstoryId).startsWith(CATALOG_PREFIX)) return null;
  return String(backstoryId).slice(CATALOG_PREFIX.length);
}

function isCatalogBackstoryId(id) {
  return !!parseCatalogUuid(id);
}

function sanitizeSceneKey(raw) {
  const s = raw ? String(raw).trim() : "";
  return VALID_SCENES.includes(s) ? s : null;
}

function sanitizePreset(raw) {
  const p = raw ? String(raw).trim() : "standard";
  return VALID_PRESETS.includes(p) ? p : "standard";
}

function sanitizeCardPoolCustom(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const [key, values] of Object.entries(raw)) {
    if (!Array.isArray(values)) continue;
    const list = values.map((v) => String(v).trim()).filter(Boolean);
    if (list.length) out[key] = list;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeTags(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    list = raw.split(/[,;\n]+/);
  }
  return list
    .map((t) => String(t).trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 8);
}

function authorAvatarUrlFromRow(row) {
  if (!row?.author_avatar_webp && !row?.avatar_webp) return null;
  const authorId = row.author_id;
  if (!authorId) return null;
  const updated = row.author_avatar_updated_at || row.avatar_updated_at;
  const v =
    updated instanceof Date
      ? updated.getTime()
      : updated
        ? new Date(updated).getTime()
        : Date.now();
  return `/api/avatars/${authorId}?v=${v}`;
}

function authorProfileIdFromRow(row) {
  return row?.author_profile_id || row?.profile_id || row?.author_id || null;
}

function bunkerRollIdForEntry(entry) {
  if (entry.cardPoolPreset === "18plus") return "vulgar";
  return "nuclear";
}

function cardPoolsForEntry(entry) {
  if (entry.cardPoolPreset === "custom" && entry.cardPoolCustom) {
    return entry.cardPoolCustom;
  }
  return gameData.getCardPools(bunkerRollIdForEntry(entry));
}

function rowToEntry(row) {
  if (!row) return null;
  const cardPoolCustom = row.card_pool_custom || null;
  const entry = {
    catalogId: row.id,
    id: catalogBackstoryId(row.id),
    authorId: row.author_id,
    title: row.title,
    text: row.text,
    locationLabel: row.location_label || "В бункере",
    scene: row.scene_key || null,
    hasCover: !!row.cover_webp,
    coverUrl: row.cover_webp ? `/api/scenarios/catalog/${row.id}/cover` : null,
    cardPoolPreset: row.card_pool_preset || "standard",
    cardPoolCustom,
    status: row.status,
    reviewNote: row.review_note || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: Array.isArray(row.tags) ? row.tags : [],
    playCount: row.play_count != null ? Number(row.play_count) : 0,
    ratingSum: row.rating_sum != null ? Number(row.rating_sum) : 0,
    ratingCount: row.rating_count != null ? Number(row.rating_count) : 0,
    authorNickname: row.author_nickname || null,
    authorProfileId: authorProfileIdFromRow(row),
    authorAvatarUrl: authorAvatarUrlFromRow(row),
    publishedAt: row.reviewed_at || row.updated_at || null,
  };
  if (entry.cardPoolPreset === "18plus") entry.badge = "Сценарий 18+";
  entry.cardPools = cardPoolsForEntry(entry);
  return attachRatingFields(entry);
}

function entryToBackstory(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    title: entry.title,
    text: entry.text,
    scene: entry.scene,
    locationLabel: entry.locationLabel,
    badge: entry.badge,
    coverUrl: entry.coverUrl,
    cardPools: entry.cardPools,
    cardPoolPreset: entry.cardPoolPreset,
    tags: entry.tags || [],
    playCount: entry.playCount || 0,
    ratingAvg: entry.ratingAvg ?? null,
    ratingCount: entry.ratingCount || 0,
    authorNickname: entry.authorNickname || null,
    authorProfileId: entry.authorProfileId || null,
    authorAvatarUrl: entry.authorAvatarUrl || null,
    publishedAt: entry.publishedAt || entry.reviewedAt || null,
    reviewedAt: entry.reviewedAt || null,
  };
}

async function refreshPublishedCache() {
  try {
    const { rows } = await getPool().query(
      `SELECT sc.*, u.nickname AS author_nickname, u.profile_id AS author_profile_id,
              u.avatar_webp AS author_avatar_webp, u.avatar_updated_at AS author_avatar_updated_at
       FROM scenario_catalog sc
       JOIN users u ON u.id = sc.author_id
       WHERE sc.status = 'published'
       ORDER BY sc.updated_at DESC`
    );
    publishedCache = rows.map(rowToEntry);
  } catch (err) {
    if (err.code !== "42P01") console.error("scenario catalog cache:", err.message);
    publishedCache = [];
  }
  return publishedCache;
}

function getPublishedCache(sortRaw) {
  return sortPublishedEntries(publishedCache, sortRaw).map(entryToBackstory);
}

function getPublishedEntry(backstoryId) {
  const uuid = parseCatalogUuid(backstoryId);
  if (!uuid) return null;
  const hit = publishedCache.find((e) => e.catalogId === uuid);
  return hit || null;
}

function getEntryByBackstoryId(backstoryId) {
  const uuid = parseCatalogUuid(backstoryId);
  if (!uuid) return null;
  return publishedCache.find((e) => e.catalogId === uuid) || null;
}

async function getEntryById(id) {
  const { rows } = await getPool().query(`SELECT * FROM scenario_catalog WHERE id = $1`, [id]);
  return rowToEntry(rows[0]);
}

async function listPublished(sortRaw) {
  if (!publishedCache.length) await refreshPublishedCache();
  return getPublishedCache(sortRaw);
}

async function countPublishedByAuthor(authorId) {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS c FROM scenario_catalog WHERE author_id = $1 AND status = 'published'`,
    [authorId]
  );
  return rows[0]?.c || 0;
}

async function listPublishedByAuthor(authorId, sortRaw) {
  const { rows } = await getPool().query(
    `SELECT sc.*, u.nickname AS author_nickname, u.profile_id AS author_profile_id,
            u.avatar_webp AS author_avatar_webp, u.avatar_updated_at AS author_avatar_updated_at
     FROM scenario_catalog sc
     JOIN users u ON u.id = sc.author_id
     WHERE sc.author_id = $1 AND sc.status = 'published'`,
    [authorId]
  );
  return sortPublishedEntries(rows.map(rowToEntry), sortRaw).map(entryToBackstory);
}

async function getUserRating(userId, catalogId) {
  const { rows } = await getPool().query(
    `SELECT rating FROM scenario_ratings WHERE catalog_id = $1 AND user_id = $2`,
    [catalogId, userId]
  );
  return rows[0]?.rating != null ? Number(rows[0].rating) : null;
}

async function syncRatingAggregates(catalogId) {
  await getPool().query(
    `UPDATE scenario_catalog SET
      rating_sum = COALESCE((SELECT SUM(rating) FROM scenario_ratings WHERE catalog_id = $1), 0),
      rating_count = COALESCE((SELECT COUNT(*)::int FROM scenario_ratings WHERE catalog_id = $1), 0),
      updated_at = NOW()
     WHERE id = $1`,
    [catalogId]
  );
}

async function rateScenario(userId, catalogId, ratingRaw) {
  const rating = Math.round(Number(ratingRaw));
  if (rating < 1 || rating > 5) {
    return { ok: false, error: "Оценка от 1 до 5." };
  }
  const entry = await getEntryById(catalogId);
  if (!entry || entry.status !== "published") {
    return { ok: false, error: "Сценарий не найден или не опубликован." };
  }
  await getPool().query(
    `INSERT INTO scenario_ratings (catalog_id, user_id, rating, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (catalog_id, user_id) DO UPDATE SET
       rating = EXCLUDED.rating,
       updated_at = NOW()`,
    [catalogId, userId, rating]
  );
  await syncRatingAggregates(catalogId);
  if (entry.status === "published") await refreshPublishedCache();
  const updated = await getEntryById(catalogId);
  const { syncAchievementsForUser } = require("./achievement-store");
  syncAchievementsForUser(entry.authorId).catch(() => {});
  return {
    ok: true,
    yourRating: rating,
    ratingAvg: updated.ratingAvg,
    ratingCount: updated.ratingCount,
    catalogId,
    backstoryId: updated.id,
  };
}

async function listByAuthor(authorId) {
  const { rows } = await getPool().query(
    `SELECT * FROM scenario_catalog WHERE author_id = $1 ORDER BY updated_at DESC`,
    [authorId]
  );
  return rows.map(rowToEntry);
}

async function listPending() {
  const { rows } = await getPool().query(
    `SELECT sc.*, u.nickname AS author_nickname
     FROM scenario_catalog sc
     JOIN users u ON u.id = sc.author_id
     WHERE sc.status = 'pending'
     ORDER BY sc.updated_at ASC`
  );
  return rows.map((row) => ({
    ...rowToEntry(row),
    authorNickname: row.author_nickname,
  }));
}

function validateDraftPayload(body) {
  const title = String(body?.title || "").trim().slice(0, 80);
  const text = String(body?.text || "").trim().slice(0, 4000);
  const locationLabel = String(body?.locationLabel || "В бункере").trim().slice(0, 80) || "В бункере";
  const sceneKey = sanitizeSceneKey(body?.sceneKey ?? body?.scene);
  const cardPoolPreset = sanitizePreset(body?.cardPoolPreset);
  const cardPoolCustom =
    cardPoolPreset === "custom" ? sanitizeCardPoolCustom(body?.cardPoolCustom) : null;
  if (!title || !text) return { ok: false, error: "Укажите название и описание." };
  if (cardPoolPreset === "custom" && !cardPoolCustom) {
    return { ok: false, error: "Заполните свой пак характеристик." };
  }
  const tags = sanitizeTags(body?.tags);
  return {
    ok: true,
    data: { title, text, locationLabel, sceneKey, cardPoolPreset, cardPoolCustom, tags },
  };
}

async function upsertDraft(authorId, payload, existingId) {
  const v = validateDraftPayload(payload);
  if (!v.ok) return v;

  const id = existingId || crypto.randomUUID();
  let wasPublished = false;
  if (existingId) {
    const existing = await getEntryById(existingId);
    if (!existing || existing.authorId !== authorId) {
      return { ok: false, error: "Сценарий не найден." };
    }
    if (existing.status === "pending") {
      return { ok: false, error: "Нельзя редактировать сценарий на модерации." };
    }
    wasPublished = existing.status === "published";
  }

  await getPool().query(
    `INSERT INTO scenario_catalog (
      id, author_id, title, text, location_label, scene_key,
      card_pool_preset, card_pool_custom, tags, status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, 'draft', NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      text = EXCLUDED.text,
      location_label = EXCLUDED.location_label,
      scene_key = EXCLUDED.scene_key,
      card_pool_preset = EXCLUDED.card_pool_preset,
      card_pool_custom = EXCLUDED.card_pool_custom,
      tags = EXCLUDED.tags,
      status = CASE
        WHEN scenario_catalog.status = 'published' THEN 'draft'
        WHEN scenario_catalog.status = 'rejected' THEN 'draft'
        ELSE scenario_catalog.status
      END,
      updated_at = NOW()`,
    [
      id,
      authorId,
      v.data.title,
      v.data.text,
      v.data.locationLabel,
      v.data.sceneKey,
      v.data.cardPoolPreset,
      v.data.cardPoolCustom ? JSON.stringify(v.data.cardPoolCustom) : null,
      JSON.stringify(v.data.tags),
    ]
  );

  if (wasPublished) await refreshPublishedCache();
  return { ok: true, entry: await getEntryById(id) };
}

async function submitForReview(authorId, id) {
  const entry = await getEntryById(id);
  if (!entry || entry.authorId !== authorId) {
    return { ok: false, error: "Сценарий не найден." };
  }
  if (!["draft", "rejected"].includes(entry.status)) {
    return { ok: false, error: "Отправить можно только черновик или отклонённый сценарий." };
  }
  await getPool().query(
    `UPDATE scenario_catalog SET status = 'pending', review_note = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  return { ok: true, entry: await getEntryById(id) };
}

async function approveScenario(reviewerId, id, note) {
  const entry = await getEntryById(id);
  if (!entry || entry.status !== "pending") {
    return { ok: false, error: "Сценарий не в очереди модерации." };
  }
  await getPool().query(
    `UPDATE scenario_catalog
     SET status = 'published', reviewed_by = $2, reviewed_at = NOW(),
         review_note = $3, updated_at = NOW()
     WHERE id = $1`,
    [id, reviewerId, note ? String(note).slice(0, 500) : null]
  );
  await refreshPublishedCache();
  const { syncAchievementsForUser } = require("./achievement-store");
  syncAchievementsForUser(entry.authorId).catch(() => {});
  syncAchievementsForUser(reviewerId).catch(() => {});
  const { recordScenarioPublishedActivity } = require("./activity-store");
  recordScenarioPublishedActivity(entry.authorId, id, entry.title).catch(() => {});
  return { ok: true, entry: await getEntryById(id) };
}

async function rejectScenario(reviewerId, id, note) {
  const entry = await getEntryById(id);
  if (!entry || entry.status !== "pending") {
    return { ok: false, error: "Сценарий не в очереди модерации." };
  }
  const reviewNote = String(note || "").trim().slice(0, 500) || "Отклонено модератором.";
  await getPool().query(
    `UPDATE scenario_catalog
     SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(),
         review_note = $3, updated_at = NOW()
     WHERE id = $1`,
    [id, reviewerId, reviewNote]
  );
  const { syncAchievementsForUser } = require("./achievement-store");
  syncAchievementsForUser(reviewerId).catch(() => {});
  return { ok: true, entry: await getEntryById(id) };
}

async function setCoverWebp(authorId, id, webpBuffer) {
  const entry = await getEntryById(id);
  if (!entry || entry.authorId !== authorId) {
    return { ok: false, error: "Сценарий не найден." };
  }
  if (entry.status === "pending") {
    return { ok: false, error: "Нельзя менять обложку во время модерации." };
  }
  await getPool().query(
    `UPDATE scenario_catalog SET cover_webp = $2, updated_at = NOW() WHERE id = $1`,
    [id, webpBuffer]
  );
  if (entry.status === "published") await refreshPublishedCache();
  return { ok: true, entry: await getEntryById(id) };
}

async function clearCoverWebp(authorId, id) {
  const entry = await getEntryById(id);
  if (!entry || entry.authorId !== authorId) {
    return { ok: false, error: "Сценарий не найден." };
  }
  if (entry.status === "pending") {
    return { ok: false, error: "Нельзя менять обложку во время модерации." };
  }
  await getPool().query(
    `UPDATE scenario_catalog SET cover_webp = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  if (entry.status === "published") await refreshPublishedCache();
  return { ok: true, entry: await getEntryById(id) };
}

async function getCoverBuffer(catalogId) {
  const { rows } = await getPool().query(
    `SELECT cover_webp FROM scenario_catalog WHERE id = $1`,
    [catalogId]
  );
  return rows[0]?.cover_webp || null;
}

async function processCoverUpload(imageDataUrl, crop) {
  const match = String(imageDataUrl).match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) return { ok: false, error: "Неверный формат изображения." };

  let buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return { ok: false, error: "Не удалось прочитать файл." };
  }
  if (buffer.length > 5 * 1024 * 1024) {
    return { ok: false, error: "Файл больше 5 МБ." };
  }

  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const cx = Math.max(0, Math.min(1, Number(crop?.x) || 0));
  const cy = Math.max(0, Math.min(1, Number(crop?.y) || 0));
  const cw = Math.max(0.05, Math.min(1 - cx, Number(crop?.w) || 1));
  const ch = Math.max(0.05, Math.min(1 - cy, Number(crop?.h) || 1));
  const left = Math.floor(cx * w);
  const top = Math.floor(cy * h);
  const width = Math.max(1, Math.floor(cw * w));
  const height = Math.max(1, Math.floor(ch * h));

  const webp = await sharp(buffer)
    .extract({ left, top, width, height })
    .resize(800, 600, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();

  return { ok: true, webp };
}

async function deleteByAuthor(authorId, id) {
  const entry = await getEntryById(id);
  if (!entry || entry.authorId !== authorId) {
    return { ok: false, error: "Сценарий не найден." };
  }
  if (entry.status === "pending") {
    return { ok: false, error: "Дождитесь решения модерации или отмените отправку." };
  }
  const wasPublished = entry.status === "published";
  await getPool().query(`DELETE FROM scenario_catalog WHERE id = $1`, [id]);
  if (wasPublished) await refreshPublishedCache();
  return { ok: true };
}

async function incrementPlayCount(backstoryId) {
  const uuid = parseCatalogUuid(backstoryId);
  if (!uuid) return;
  try {
    await getPool().query(
      `UPDATE scenario_catalog SET play_count = play_count + 1 WHERE id = $1 AND status = 'published'`,
      [uuid]
    );
    const hit = publishedCache.find((e) => e.catalogId === uuid);
    if (hit) hit.playCount = (hit.playCount || 0) + 1;
  } catch (err) {
    if (err.code !== "42P01") console.error("incrementPlayCount:", err.message);
  }
}

async function listScenarioComments(catalogId, limit = 30) {
  const { rows } = await getPool().query(
    `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.nickname, u.profile_id
     FROM scenario_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.catalog_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [catalogId, Math.min(limit, 50)]
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    user: { id: r.user_id, profileId: r.profile_id || r.user_id, nickname: r.nickname },
  }));
}

async function addScenarioComment(userId, catalogId, body) {
  const entry = await getEntryById(catalogId);
  if (!entry || entry.status !== "published") {
    return { ok: false, error: "Сценарий не найден." };
  }
  const text = (body || "").trim().slice(0, 1000);
  if (!text) return { ok: false, error: "Комментарий не может быть пустым." };
  const id = crypto.randomBytes(12).toString("hex");
  await getPool().query(
    `INSERT INTO scenario_comments (id, catalog_id, user_id, body) VALUES ($1, $2, $3, $4)`,
    [id, catalogId, userId, text]
  );
  return { ok: true, comment: { id, body: text, createdAt: new Date().toISOString() } };
}

async function deleteScenarioComment(userId, commentId, isDev = false) {
  const { rows } = await getPool().query(
    `SELECT user_id FROM scenario_comments WHERE id = $1`,
    [commentId]
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "Комментарий не найден." };
  if (!isDev && row.user_id !== userId) {
    return { ok: false, error: "Нельзя удалить чужой комментарий." };
  }
  await getPool().query(`DELETE FROM scenario_comments WHERE id = $1`, [commentId]);
  return { ok: true };
}

async function toggleScenarioFavorite(userId, catalogId) {
  const entry = await getEntryById(catalogId);
  if (!entry || entry.status !== "published") {
    return { ok: false, error: "Сценарий не найден." };
  }
  const existing = await getPool().query(
    `SELECT 1 FROM scenario_favorites WHERE catalog_id = $1 AND user_id = $2`,
    [catalogId, userId]
  );
  if (existing.rows[0]) {
    await getPool().query(
      `DELETE FROM scenario_favorites WHERE catalog_id = $1 AND user_id = $2`,
      [catalogId, userId]
    );
    return { ok: true, favorited: false };
  }
  await getPool().query(
    `INSERT INTO scenario_favorites (catalog_id, user_id) VALUES ($1, $2)`,
    [catalogId, userId]
  );
  return { ok: true, favorited: true };
}

async function listScenarioFavorites(userId) {
  const { rows } = await getPool().query(
    `SELECT sc.id, sc.title, sc.play_count, sc.rating_sum, sc.rating_count, sf.created_at
     FROM scenario_favorites sf
     JOIN scenario_catalog sc ON sc.id = sf.catalog_id
     WHERE sf.user_id = $1 AND sc.status = 'published'
     ORDER BY sf.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    playCount: r.play_count,
    ratingAvg: r.rating_count ? Math.round((r.rating_sum / r.rating_count) * 10) / 10 : null,
    favoritedAt: r.created_at,
  }));
}

async function isScenarioFavorited(userId, catalogId) {
  if (!userId) return false;
  const { rows } = await getPool().query(
    `SELECT 1 FROM scenario_favorites WHERE catalog_id = $1 AND user_id = $2`,
    [catalogId, userId]
  );
  return rows.length > 0;
}

module.exports = {
  CATALOG_PREFIX,
  VALID_SCENES,
  VALID_PRESETS,
  catalogBackstoryId,
  parseCatalogUuid,
  isCatalogBackstoryId,
  refreshPublishedCache,
  getPublishedCache,
  getPublishedEntry,
  getEntryByBackstoryId,
  getEntryById,
  listPublished,
  listByAuthor,
  listPending,
  upsertDraft,
  submitForReview,
  approveScenario,
  rejectScenario,
  setCoverWebp,
  clearCoverWebp,
  getCoverBuffer,
  processCoverUpload,
  deleteByAuthor,
  incrementPlayCount,
  rateScenario,
  getUserRating,
  countPublishedByAuthor,
  listPublishedByAuthor,
  sanitizeSort,
  sortPublishedEntries,
  VALID_SORTS,
  sanitizeTags,
  entryToBackstory,
  bunkerRollIdForEntry,
  cardPoolsForEntry,
  listScenarioComments,
  addScenarioComment,
  deleteScenarioComment,
  toggleScenarioFavorite,
  listScenarioFavorites,
  isScenarioFavorited,
};
