const gameData = require("./game-data");

const CUSTOM_BACKSTORY_ID = "custom";

const KEY_DEV_BACKSTORIES = "dev_backstory_overrides";
const KEY_DEV_CARD_POOLS = "dev_card_pool_overrides";

let devBackstoryOverrides = {};
let devCardPoolOverrides = {};

function parseJsonSetting(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function loadCatalogOverrides(pool) {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM site_settings WHERE key = ANY($1::text[])`,
      [[KEY_DEV_BACKSTORIES, KEY_DEV_CARD_POOLS]]
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    devBackstoryOverrides = parseJsonSetting(map[KEY_DEV_BACKSTORIES]);
    devCardPoolOverrides = parseJsonSetting(map[KEY_DEV_CARD_POOLS]);
  } catch (err) {
    if (err.code !== "42P01") console.error("catalog overrides load:", err.message);
  }
}

async function saveDevBackstoryOverrides(pool, overrides) {
  devBackstoryOverrides = overrides && typeof overrides === "object" ? overrides : {};
  await pool.query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [KEY_DEV_BACKSTORIES, JSON.stringify(devBackstoryOverrides)]
  );
}

async function saveDevCardPoolOverrides(pool, overrides) {
  devCardPoolOverrides = overrides && typeof overrides === "object" ? overrides : {};
  await pool.query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [KEY_DEV_CARD_POOLS, JSON.stringify(devCardPoolOverrides)]
  );
}

function getDevCatalogState() {
  return {
    backstoryOverrides: devBackstoryOverrides,
    cardPoolOverrides: devCardPoolOverrides,
  };
}

function sanitizeCustomBackstory(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim().slice(0, 80);
  const text = String(raw.text || "").trim().slice(0, 4000);
  if (!title || !text) return null;
  const scene = raw.scene ? String(raw.scene).trim().slice(0, 32) : null;
  const locationLabel = raw.locationLabel
    ? String(raw.locationLabel).trim().slice(0, 80)
    : "В бункере";
  return { id: CUSTOM_BACKSTORY_ID, title, text, scene, locationLabel };
}

function getEffectiveBackstories() {
  return gameData.BACKSTORIES.map((b) => {
    const patch = devBackstoryOverrides[b.id];
    if (!patch || typeof patch !== "object") return { ...b };
    return {
      ...b,
      title: patch.title != null ? String(patch.title).slice(0, 80) : b.title,
      text: patch.text != null ? String(patch.text).slice(0, 4000) : b.text,
      scene: patch.scene != null ? patch.scene : b.scene,
      locationLabel:
        patch.locationLabel != null ? String(patch.locationLabel).slice(0, 80) : b.locationLabel,
      badge: patch.badge != null ? patch.badge : b.badge,
    };
  });
}

function findBackstory(id) {
  if (id === CUSTOM_BACKSTORY_ID) return null;
  return getEffectiveBackstories().find((b) => b.id === id) || null;
}

function isValidBackstoryId(id, settings) {
  if (id === CUSTOM_BACKSTORY_ID) return !!sanitizeCustomBackstory(settings?.customBackstory);
  return !!findBackstory(id);
}

function mergeCardPools(scenarioId, sessionPools) {
  const base = gameData.getCardPools(scenarioId);
  const merged = { ...base };
  for (const [key, values] of Object.entries(devCardPoolOverrides)) {
    if (Array.isArray(values) && values.length) merged[key] = values.map(String);
  }
  if (sessionPools && typeof sessionPools === "object") {
    for (const [key, values] of Object.entries(sessionPools)) {
      if (Array.isArray(values) && values.length) merged[key] = values.map(String);
    }
  }
  return merged;
}

function dealPlayerCards(scenarioId, sessionPools) {
  const pools = mergeCardPools(scenarioId, sessionPools);
  const hasOverride =
    Object.keys(devCardPoolOverrides).length > 0 ||
    (sessionPools && Object.keys(sessionPools).length > 0);
  if (!hasOverride) return gameData.dealPlayerCards(scenarioId);
  return gameData.dealPlayerCards(scenarioId, pools);
}

function getScenarioPreview(settings) {
  if (settings.backstoryRandom) {
    return gameData.getScenarioPreview(settings);
  }
  if (settings.backstoryId === CUSTOM_BACKSTORY_ID) {
    const custom = sanitizeCustomBackstory(settings.customBackstory);
    if (!custom) {
      return {
        isRandom: false,
        id: CUSTOM_BACKSTORY_ID,
        title: "Своя катастрофа",
        text: "Заполните описание катастрофы в редакторе.",
        scene: null,
        bunkerParamsPending: true,
        bunkerParamsNote: gameData.BUNKER_PARAMS_PENDING_NOTE,
      };
    }
    return {
      isRandom: false,
      id: custom.id,
      scene: custom.scene,
      title: custom.title,
      text: custom.text,
      locationLabel: custom.locationLabel,
      bunkerParamsPending: true,
      bunkerParamsNote: gameData.BUNKER_PARAMS_PENDING_NOTE,
    };
  }
  const story = findBackstory(settings.backstoryId) || getEffectiveBackstories()[0];
  return {
    isRandom: false,
    id: story.id,
    scene: story.scene,
    title: story.title,
    text: story.text,
    badge: story.badge,
    locationLabel: story.locationLabel,
    bunkerParamsPending: true,
    bunkerParamsNote: gameData.BUNKER_PARAMS_PENDING_NOTE,
  };
}

function buildActiveBackstory(settings, playerCount) {
  let story;
  if (settings.backstoryRandom) {
    story = gameData.pickRandom(getEffectiveBackstories());
  } else if (settings.backstoryId === CUSTOM_BACKSTORY_ID) {
    const custom = sanitizeCustomBackstory(settings.customBackstory);
    story = custom || getEffectiveBackstories()[0];
  } else {
    story = findBackstory(settings.backstoryId) || getEffectiveBackstories()[0];
  }
  const spots = gameData.getBunkerSpots(playerCount);
  const bunker = gameData.rollBunkerProfile(story.id);
  return {
    id: story.id,
    scene: story.scene,
    title: story.title,
    text: story.text,
    bunkerSpots: spots,
    spotsText: `Мест в бункере: ${spots} (из ${playerCount} претендентов).`,
    badge: story.badge,
    bunkerParamsPending: false,
    locationLabel: story.locationLabel,
    ...bunker,
  };
}

function applySettingsPayload(game, payload) {
  if (payload?.mode && gameData.MODES.some((m) => m.id === payload.mode)) {
    game.settings.mode = payload.mode;
  }
  if (typeof payload?.backstoryRandom === "boolean") {
    game.settings.backstoryRandom = payload.backstoryRandom;
  }
  if (payload?.backstoryId && isValidBackstoryId(payload.backstoryId, payload)) {
    game.settings.backstoryId = payload.backstoryId;
    game.settings.backstoryRandom = false;
  }
  if (payload?.customBackstory !== undefined) {
    const custom = sanitizeCustomBackstory(payload.customBackstory);
    game.settings.customBackstory = custom;
  }
  if (payload?.customCardPools !== undefined && payload.customCardPools) {
    game.settings.customCardPools =
      typeof payload.customCardPools === "object" ? payload.customCardPools : null;
  }
}

function getCatalogForHost() {
  return {
    modes: gameData.MODES,
    backstories: getEffectiveBackstories(),
    customBackstoryId: CUSTOM_BACKSTORY_ID,
    cardTypes: gameData.CARD_TYPES,
    cardPools: mergeCardPools("nuclear", null),
  };
}

module.exports = {
  CUSTOM_BACKSTORY_ID,
  loadCatalogOverrides,
  saveDevBackstoryOverrides,
  saveDevCardPoolOverrides,
  getDevCatalogState,
  getEffectiveBackstories,
  sanitizeCustomBackstory,
  isValidBackstoryId,
  mergeCardPools,
  dealPlayerCards,
  getScenarioPreview,
  buildActiveBackstory,
  applySettingsPayload,
  getCatalogForHost,
  gameData,
};
