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

let publishedCache = [];

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
  };
  if (entry.cardPoolPreset === "18plus") entry.badge = "Сценарий 18+";
  entry.cardPools = cardPoolsForEntry(entry);
  return entry;
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
  };
}

async function refreshPublishedCache() {
  try {
    const { rows } = await getPool().query(
      `SELECT * FROM scenario_catalog WHERE status = 'published' ORDER BY updated_at DESC`
    );
    publishedCache = rows.map(rowToEntry);
  } catch (err) {
    if (err.code !== "42P01") console.error("scenario catalog cache:", err.message);
    publishedCache = [];
  }
  return publishedCache;
}

function getPublishedCache() {
  return publishedCache.map(entryToBackstory);
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

async function listPublished() {
  if (!publishedCache.length) await refreshPublishedCache();
  return publishedCache.map(entryToBackstory);
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
  return {
    ok: true,
    data: { title, text, locationLabel, sceneKey, cardPoolPreset, cardPoolCustom },
  };
}

async function upsertDraft(authorId, payload, existingId) {
  const v = validateDraftPayload(payload);
  if (!v.ok) return v;

  const id = existingId || crypto.randomUUID();
  if (existingId) {
    const existing = await getEntryById(existingId);
    if (!existing || existing.authorId !== authorId) {
      return { ok: false, error: "Сценарий не найден." };
    }
    if (existing.status === "pending") {
      return { ok: false, error: "Нельзя редактировать сценарий на модерации." };
    }
  }

  await getPool().query(
    `INSERT INTO scenario_catalog (
      id, author_id, title, text, location_label, scene_key,
      card_pool_preset, card_pool_custom, status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'draft', NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      text = EXCLUDED.text,
      location_label = EXCLUDED.location_label,
      scene_key = EXCLUDED.scene_key,
      card_pool_preset = EXCLUDED.card_pool_preset,
      card_pool_custom = EXCLUDED.card_pool_custom,
      status = CASE
        WHEN scenario_catalog.status = 'published' THEN 'published'
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
    ]
  );

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

async function getCoverBuffer(catalogId) {
  const { rows } = await getPool().query(
    `SELECT cover_webp FROM scenario_catalog WHERE id = $1 AND status = 'published'`,
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
  getCoverBuffer,
  processCoverUpload,
  entryToBackstory,
  bunkerRollIdForEntry,
  cardPoolsForEntry,
};
