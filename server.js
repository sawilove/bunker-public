try {
  require("dotenv").config();
} catch {
  /* dotenv опционален */
}

const crypto = require("crypto");
const express = require("express");
const http = require("http");
const path = require("path");
const QRCode = require("qrcode");
const { Server } = require("socket.io");
const catalogRuntime = require("./catalog-runtime");
const {
  dealPlayerCards,
  buildActiveBackstory,
  getScenarioPreview,
  applySettingsPayload,
  getCatalogForHost,
  CUSTOM_BACKSTORY_ID,
  gameData,
} = catalogRuntime;
const {
  shuffleArray,
  pickRandom,
  MODES,
  getRevealPerRound,
  getMaxRound,
  getBunkerSpots,
} = gameData;
const {
  mountAuthRoutes,
  resolvePlayerIdentity,
  recordGameStats,
  verifyToken,
  hasPremiumAccess,
} = require("./backend/auth");
const { mountSocialRoutes, mountSocialSockets, purgeOldChatMessages, syncInGameFromPlayers } =
  require("./backend/social");
const { loadSiteSettings, mountDevRoutes, maintenanceMiddleware, initDatabase } =
  require("./backend/core");
const { mountNewsRoutes, seedNewsIfEmpty } = require("./backend/news");
const { mountScenarioCatalogRoutes } = require("./scenario-catalog-routes");
const { mountAchievementRoutes } = require("./achievement-routes");
const { mountSocialPlatformRoutes } = require("./social-platform-routes");
const { requireUser } = require("./auth-routes");
const scenarioCatalog = require("./scenario-catalog-store");

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "6mb" }));
app.use(maintenanceMiddleware);
mountAuthRoutes(app);
mountAchievementRoutes(app);
mountScenarioCatalogRoutes(app, { verifyToken, requireUser });
mountDevRoutes(app);
mountNewsRoutes(app);

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : true;

const io = new Server(server, {
  cors: { origin: corsOrigins, methods: ["GET", "POST"] },
});

mountSocialRoutes(app, io);
mountSocialPlatformRoutes(app, io);

app.use(express.static("public"));
app.use("/scenarios", express.static(path.join(__dirname, "public", "scenarios")));
app.use("/scenarios", express.static(path.join(__dirname, "resources", "scenarios")));
app.use("/stickers", express.static(path.join(__dirname, "resources", "stickers")));

app.get("/api/qr.png", async (req, res) => {
  const data = req.query.data;
  if (!data || typeof data !== "string" || data.length > 512) {
    res.status(400).end();
    return;
  }
  try {
    const png = await QRCode.toBuffer(data, {
      type: "png",
      width: 180,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    res.type("png").send(png);
  } catch {
    res.status(500).end();
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "player.html"));
});

app.get("/game/:code", (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  const safeCode = code.slice(0, 16);
  if (!safeCode) {
    res.redirect(302, "/player");
    return;
  }
  res.sendFile(path.join(__dirname, "public", "player.html"));
});

let hostId = null;
let hostSocketId = null;
let hostAuthUser = null;
let sessionCode = null;

/** socket.id -> playerId */
const socketToPlayer = new Map();

const SESSION_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSessionCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += SESSION_CHARS[Math.floor(Math.random() * SESSION_CHARS.length)];
  }
  return code;
}

function generatePersistentId() {
  return crypto.randomBytes(16).toString("hex");
}

function normalizeCode(code) {
  return (code || "").trim().toUpperCase().slice(0, 6);
}

const game = {
  phase: "setup",
  settings: {
    mode: "classic",
    backstoryId: gameData.BACKSTORIES[0].id,
    backstoryRandom: false,
    customBackstory: null,
    customCardPools: null,
  },
  players: {},
  currentTurn: null,
  activeBackstory: null,
  initialPlayerCount: 0,
  round: 1,
  revealsThisRound: {},
  turnOrder: [],
  votes: {},
  lastExcludedName: null,
};

function playerIds() {
  return Object.keys(game.players);
}

function playerCount() {
  return playerIds().length;
}

function activePlayerIds() {
  return playerIds().filter((id) => !game.players[id].excluded);
}

function activeCount() {
  return activePlayerIds().length;
}

function isHostSocket(socket) {
  return socket.id === hostSocketId;
}

function getPlayerIdBySocket(socketId) {
  return socketToPlayer.get(socketId) || null;
}

function bindPlayerSocket(playerId, socketId) {
  const prev = game.players[playerId]?.socketId;
  if (prev && prev !== socketId) {
    socketToPlayer.delete(prev);
  }
  game.players[playerId].socketId = socketId;
  socketToPlayer.set(socketId, playerId);
}

function unbindPlayerSocket(socketId) {
  const playerId = socketToPlayer.get(socketId);
  if (!playerId || !game.players[playerId]) return null;
  game.players[playerId].socketId = null;
  socketToPlayer.delete(socketId);
  return playerId;
}

function bindHostSocket(socketId) {
  hostSocketId = socketId;
}

function emitToPlayer(playerId, event, payload) {
  const sid = game.players[playerId]?.socketId;
  if (sid) io.to(sid).emit(event, payload);
}

function bunkerSpots() {
  return game.activeBackstory?.bunkerSpots ?? getBunkerSpots(game.initialPlayerCount || 6);
}

function syncTurnOrder() {
  const active = activePlayerIds();
  game.turnOrder = game.turnOrder.filter((id) => active.includes(id));
  for (const id of active) {
    if (!game.turnOrder.includes(id)) {
      game.turnOrder.push(id);
    }
  }
}

function advanceTurn() {
  syncTurnOrder();
  const order = game.turnOrder;
  if (order.length === 0) {
    game.currentTurn = null;
    return;
  }
  const idx = order.indexOf(game.currentTurn);
  const nextIdx = idx === -1 ? 0 : (idx + 1) % order.length;
  game.currentTurn = order[nextIdx];
}

function roundQuota() {
  return getRevealPerRound(game.initialPlayerCount, game.round);
}

function initRevealsThisRound() {
  game.revealsThisRound = {};
  for (const id of activePlayerIds()) {
    game.revealsThisRound[id] = 0;
  }
}

function allActiveMetRoundQuota() {
  const quota = roundQuota();
  if (quota === 0) return true;
  const active = activePlayerIds();
  if (active.length === 0) return true;
  return active.every((id) => (game.revealsThisRound[id] || 0) >= quota);
}

function mapCardForClient(card, revealAll = false) {
  const base = {
    type: card.type,
    label: card.label,
    value: card.value,
    opened: card.opened || revealAll,
  };
  if (card.type === "profession") {
    base.profession = card.profession;
    base.professionLevel = card.professionLevel;
  }
  if (card.type === "health" && card.condition) {
    base.condition = card.condition;
    base.conditionLevel = card.conditionLevel;
  }
  return base;
}

function revealAllCards() {
  for (const id of playerIds()) {
    for (const card of game.players[id].cards) {
      card.opened = true;
    }
  }
}

function buildCatalogRatingState(forUserId) {
  if (game.phase !== "ended") return null;
  if (!catalogRuntime.isCatalogBackstoryId(game.settings.backstoryId)) return null;
  const catalogId = game.catalogRateCatalogId || scenarioCatalog.parseCatalogUuid(game.settings.backstoryId);
  if (!catalogId) return null;
  const entry = scenarioCatalog.getPublishedEntry(game.settings.backstoryId);
  const yourRating =
    forUserId && game.catalogRatingsByUser ? game.catalogRatingsByUser[forUserId] ?? null : null;
  return {
    catalogId,
    backstoryId: game.settings.backstoryId,
    title: game.activeBackstory?.title || entry?.title || "Катастрофа",
    ratingAvg: entry?.ratingAvg ?? null,
    ratingCount: entry?.ratingCount || 0,
    canRate: !!forUserId,
    yourRating,
  };
}

async function preloadCatalogRatingsForPlayers() {
  const catalogId = game.catalogRateCatalogId;
  if (!catalogId) return;
  game.catalogRatingsByUser = game.catalogRatingsByUser || {};
  for (const id of playerIds()) {
    const uid = game.players[id]?.userId;
    if (!uid) continue;
    try {
      game.catalogRatingsByUser[uid] = await scenarioCatalog.getUserRating(uid, catalogId);
    } catch (err) {
      console.error("preloadCatalogRatings", err.message);
    }
  }
}

function endGame() {
  game.phase = "ended";
  game.currentTurn = null;
  revealAllCards();
  game.catalogRatingsByUser = {};
  if (catalogRuntime.isCatalogBackstoryId(game.settings.backstoryId)) {
    game.catalogRateCatalogId = scenarioCatalog.parseCatalogUuid(game.settings.backstoryId);
    preloadCatalogRatingsForPlayers()
      .then(() => broadcast())
      .catch((err) => console.error("preloadCatalogRatings error", err));
  } else {
    game.catalogRateCatalogId = null;
  }

  const playerUserIds = playerIds().map((id) => game.players[id].userId);
  const survivorUserIds = activePlayerIds()
    .filter((id) => !game.players[id].excluded)
    .map((id) => game.players[id].userId);
  recordGameStats(playerUserIds, survivorUserIds).catch((err) => {
    console.error("recordGameStats error", err);
  });
}

function startVoting() {
  game.phase = "voting";
  game.currentTurn = null;
  game.votes = {};
}

function resolveVoting() {
  const tallies = {};
  for (const targetId of Object.values(game.votes)) {
    if (!game.players[targetId] || game.players[targetId].excluded) continue;
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  let candidates = [];
  for (const [id, count] of Object.entries(tallies)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [id];
    } else if (count === maxVotes && count > 0) {
      candidates.push(id);
    }
  }

  if (candidates.length > 0 && maxVotes > 0) {
    const excludedId = pickRandom(candidates);
    game.players[excludedId].excluded = true;
    game.lastExcludedName = game.players[excludedId].name;
    game.turnOrder = game.turnOrder.filter((id) => id !== excludedId);
  } else {
    game.lastExcludedName = null;
  }

  if (activeCount() === bunkerSpots()) {
    endGame();
    return;
  }

  if (game.round < getMaxRound(game.initialPlayerCount)) {
    game.round += 1;
    initRevealsThisRound();
    game.phase = "playing";
    syncTurnOrder();
    game.currentTurn = game.turnOrder[0] || null;
    return;
  }

  startVoting();
}

function checkRoundComplete() {
  if (game.phase !== "playing") return;
  if (!allActiveMetRoundQuota()) return;
  startVoting();
}

function finishPlayerTurn(playerId) {
  const quota = roundQuota();
  const done = game.revealsThisRound[playerId] || 0;
  if (done >= quota) {
    advanceTurn();
    checkRoundComplete();
  }
}

function buildVotingInfo(forPlayerId) {
  const active = activePlayerIds();
  const targets = active
    .filter((id) => id !== forPlayerId)
    .map((id) => ({ id, name: game.players[id].name }));
  const votersNeeded = active.filter((id) => !game.players[id].excluded).length;
  const votesCast = Object.keys(game.votes).length;
  return {
    targets,
    votesCast,
    votersNeeded,
    allVoted: votesCast >= votersNeeded && votersNeeded > 0,
    myVote: game.votes[forPlayerId] || null,
    canVote:
      forPlayerId &&
      active.includes(forPlayerId) &&
      !game.players[forPlayerId].excluded,
    lastExcludedName: game.lastExcludedName,
  };
}

function mapPlayerBrief(id) {
  const p = game.players[id];
  return {
    id,
    name: p.name,
    excluded: !!p.excluded,
    connected: !!p.socketId,
    isGuest: !!p.isGuest,
    nickname: p.nickname || null,
    avatarUrl: p.avatarUrl,
  };
}

function sanitizePlayerForHost(id, p) {
  const revealAll = game.phase === "ended";
  return {
    id,
    name: p.name,
    excluded: !!p.excluded,
    connected: !!p.socketId,
    isGuest: !!p.isGuest,
    nickname: p.nickname || null,
    avatarUrl: p.avatarUrl,
    revealsThisRound: game.revealsThisRound[id] || 0,
    cards: p.cards.map((c) => {
      if (revealAll || c.opened) {
        return { ...mapCardForClient(c, revealAll), opened: true };
      }
      return { opened: false };
    }),
  };
}

function sanitizeScenarioForPlayer(data) {
  if (!data) return null;
  const { text, ...rest } = data;
  return rest;
}

function buildRoundInfo() {
  const quota = roundQuota();
  return {
    number: game.round,
    max: getMaxRound(game.initialPlayerCount),
    revealQuota: quota,
    allMetQuota: allActiveMetRoundQuota(),
  };
}

function endHostSession() {
  for (const id of [...playerIds()]) {
    emitToPlayer(id, "sessionEnded", "Ведущий завершил сессию.");
    removePlayer(id);
  }
  resetToSetup();
}

function resetToSetup() {
  game.phase = "setup";
  sessionCode = null;
  hostId = null;
  hostSocketId = null;
  socketToPlayer.clear();
  game.players = {};
  game.currentTurn = null;
  game.activeBackstory = null;
  game.initialPlayerCount = 0;
  game.round = 1;
  game.revealsThisRound = {};
  game.turnOrder = [];
  game.votes = {};
  game.lastExcludedName = null;
  game.catalogRateCatalogId = null;
  game.catalogRatingsByUser = {};
  syncInGameFromPlayers(game.players, game.phase);
}

function openLobby() {
  game.phase = "lobby";
  sessionCode = generateSessionCode();
  syncInGameFromPlayers(game.players, game.phase);
}

function handleAllPlayersLeft() {
  if (playerIds().length > 0) return;
  if (game.phase === "ended") {
    resetToSetup();
  } else if (["playing", "voting"].includes(game.phase)) {
    resetToLobby();
  }
}

function buildHostState(hostUser = null) {
  const n = playerIds().length;
  const active = activeCount();
  return {
    role: "host",
    phase: game.phase,
    hostId,
    sessionCode,
    catalog: getCatalogForHost({ loggedIn: !!hostUser }),
    settings: { ...game.settings },
    backstory: ["playing", "voting", "ended"].includes(game.phase)
      ? game.activeBackstory
      : null,
    scenario: game.phase === "lobby" ? getScenarioPreview(game.settings) : null,
    bunkerSpots: bunkerSpots(),
    survivorsCount: active,
    round: ["playing", "voting"].includes(game.phase) ? buildRoundInfo() : null,
    voting: game.phase === "voting" ? buildVotingInfo(null) : null,
    players: playerIds().map((id) => sanitizePlayerForHost(id, game.players[id])),
    currentTurn: game.currentTurn,
    canStart: game.phase === "lobby" && n >= 1,
    minPlayersRecommended: 6,
  };
}

function buildPlayerState(playerId) {
  const me = game.players[playerId];
  const quota = game.phase === "playing" ? roundQuota() : 0;
  const myReveals = game.revealsThisRound[playerId] || 0;
  const revealAll = game.phase === "ended";
  const isActive = me && !me.excluded;

  return {
    role: "player",
    phase: game.phase,
    sessionCode,
    backstory: ["playing", "voting", "ended"].includes(game.phase)
      ? sanitizeScenarioForPlayer(game.activeBackstory)
      : null,
    scenario: game.phase === "lobby" ? sanitizeScenarioForPlayer(getScenarioPreview(game.settings)) : null,
    bunkerSpots: bunkerSpots(),
    survivorsCount: activeCount(),
    round:
      game.phase === "playing"
        ? { ...buildRoundInfo(), myReveals, remaining: Math.max(0, quota - myReveals) }
        : null,
    voting: game.phase === "voting" ? buildVotingInfo(playerId) : null,
    catalogRating: buildCatalogRatingState(me?.userId || null),
    settings: { mode: game.settings.mode },
    you: me
      ? {
          id: playerId,
          name: me.name,
          excluded: !!me.excluded,
          isGuest: !!me.isGuest,
          nickname: me.nickname || null,
          avatarUrl: me.avatarUrl,
          cards: me.cards.map((c) => mapCardForClient(c, revealAll)),
        }
      : null,
    players: playerIds().map((id) => {
      const p = game.players[id];
      return {
        id,
        name: p.name,
        userId: p.userId || null,
        isGuest: !!p.isGuest,
        nickname: p.nickname || null,
        avatarUrl: p.avatarUrl || null,
        excluded: !!p.excluded,
        connected: !!p.socketId,
      };
    }),
    currentTurn: game.currentTurn,
    isYourTurn: game.phase === "playing" && game.currentTurn === playerId && isActive,
    playerCount: playerIds().length,
  };
}

function emitHostState() {
  if (hostSocketId) {
    io.to(hostSocketId).emit("gameState", buildHostState(hostAuthUser));
  }
}

function emitAllPlayersState() {
  for (const id of playerIds()) {
    emitToPlayer(id, "gameState", buildPlayerState(id));
  }
}

function broadcast() {
  emitHostState();
  emitAllPlayersState();
}

function resetToLobby() {
  game.phase = "lobby";
  game.currentTurn = null;
  game.activeBackstory = null;
  game.initialPlayerCount = 0;
  game.round = 1;
  game.revealsThisRound = {};
  game.turnOrder = [];
  game.votes = {};
  game.lastExcludedName = null;
  for (const id of playerIds()) {
    const { name, socketId, userId, isGuest, nickname, avatarUrl, nameMode } =
      game.players[id];
    game.players[id] = {
      id,
      name,
      cards: [],
      excluded: false,
      socketId,
      userId: userId || null,
      isGuest: !!isGuest,
      nickname: nickname || null,
      avatarUrl,
      nameMode: nameMode || null,
    };
  }
}

function removePlayer(playerId) {
  const sid = game.players[playerId]?.socketId;
  if (sid) socketToPlayer.delete(sid);
  delete game.players[playerId];
  delete game.revealsThisRound[playerId];
  delete game.votes[playerId];
  syncInGameFromPlayers(game.players, game.phase);
}

function getSessionInvitePayload(userId) {
  if (game.phase !== "lobby" || !sessionCode) {
    return { error: "Сессия не в зале ожидания." };
  }
  const player = Object.values(game.players).find((p) => p.userId === userId);
  if (!player) {
    return { error: "Вы не в этой сессии." };
  }
  return {
    code: sessionCode,
    nickname: player.nickname || player.name,
  };
}

function getHostSessionInvitePayload() {
  if (game.phase !== "lobby" || !sessionCode) {
    return { error: "Сессия не в зале ожидания." };
  }
  return { code: sessionCode, nickname: "Ведущий" };
}

function resolveSessionInvite(userId, socket) {
  const fromPlayer = getSessionInvitePayload(userId);
  if (fromPlayer.code) return fromPlayer;
  if (socket && isHostSocket(socket)) return getHostSessionInvitePayload();
  return fromPlayer;
}

mountSocialSockets(io, {
  getSessionInvitePayload: resolveSessionInvite,
});

async function resolveHostUser(payload) {
  const user = payload?.authToken ? await verifyToken(payload.authToken) : null;
  if (user) hostAuthUser = user;
  return user;
}

async function applyHostSettings(payload) {
  if (!payload || typeof payload !== "object") return;
  const user = await resolveHostUser(payload);
  const premium = hasPremiumAccess(user);
  const loggedIn = !!user;
  const safe = { ...payload };
  if (!premium) {
    if (safe.backstoryId === CUSTOM_BACKSTORY_ID) return;
    delete safe.customBackstory;
    delete safe.customCardPools;
  }
  if (
    safe.backstoryId &&
    catalogRuntime.isCatalogBackstoryId(safe.backstoryId) &&
    !loggedIn
  ) {
    return;
  }
  if (
    safe.backstoryId &&
    catalogRuntime.isCatalogBackstoryId(safe.backstoryId) &&
    !catalogRuntime.isValidBackstoryId(safe.backstoryId, safe, { loggedIn })
  ) {
    return;
  }
  applySettingsPayload(game, safe, { loggedIn, premium });
}

io.on("connection", (socket) => {
  socket.on("hostJoin", async (payload) => {
    await resolveHostUser(payload || {});
    const requestedHostId = payload?.hostId || null;
    const forceNew = !!payload?.newSession;

    if (forceNew || game.phase === "ended") {
      resetToSetup();
      hostId = generatePersistentId();
    } else if (requestedHostId && hostId === requestedHostId) {
      bindHostSocket(socket.id);
    } else if (!hostId) {
      hostId = generatePersistentId();
      bindHostSocket(socket.id);
    } else if (
      hostSocketId &&
      requestedHostId &&
      hostId !== requestedHostId &&
      game.phase !== "setup"
    ) {
      socket.emit("hostError", "Эта сессия уже ведётся с другого устройства.");
      return;
    } else {
      bindHostSocket(socket.id);
    }

    socket.emit("gameState", buildHostState(hostAuthUser));
  });

  socket.on("newSession", () => {
    if (!isHostSocket(socket)) return;
    resetToSetup();
    hostId = generatePersistentId();
    bindHostSocket(socket.id);
    broadcast();
  });

  socket.on("hostEndSession", () => {
    if (!isHostSocket(socket)) return;
    endHostSession();
    socket.emit("hostSessionEnded");
  });

  socket.on("createSession", async (payload) => {
    if (!isHostSocket(socket) || game.phase !== "setup") return;
    await applyHostSettings(payload);
    if (!hostId) hostId = generatePersistentId();
    openLobby();
    broadcast();
  });

  socket.on("validateSessionCode", (code) => {
    const normalized = normalizeCode(code);
    let reason = null;
    if (game.phase === "setup") {
      reason = "not_ready";
    } else if (game.phase !== "lobby") {
      reason = "started";
    } else if (normalized !== sessionCode) {
      reason = "invalid";
    }
    socket.emit("sessionCodeResult", {
      valid: !reason,
      reason,
      code: sessionCode,
    });
  });

  socket.on("playerReconnect", (payload) => {
    const playerId = payload?.playerId;
    const code = normalizeCode(payload?.code);
    if (!playerId || !game.players[playerId]) {
      socket.emit("reconnectFailed", "Сессия не найдена. Войдите заново.");
      return;
    }
    if (code !== sessionCode) {
      socket.emit("reconnectFailed", "Неверный код сессии.");
      return;
    }
    if (game.phase === "setup") {
      socket.emit("reconnectFailed", "Сессия ещё не создана.");
      return;
    }

    bindPlayerSocket(playerId, socket.id);
    syncInGameFromPlayers(game.players, game.phase);
    socket.emit("gameState", buildPlayerState(playerId));
    broadcast();
  });

  socket.on("playerJoin", async (payload) => {
    const code = typeof payload === "string" ? null : payload?.code;
    let identity;
    try {
      identity = await resolvePlayerIdentity(
        typeof payload === "string" ? { name: payload, code } : payload
      );
    } catch (err) {
      console.error("playerJoin auth error", err);
      socket.emit("joinError", "Ошибка проверки аккаунта.");
      return;
    }

    if (!identity.ok) {
      socket.emit("joinError", identity.error);
      return;
    }

    const trimmed = identity.displayName;
    if (!trimmed) {
      socket.emit("joinError", "Введите имя.");
      return;
    }
    if (normalizeCode(code) !== sessionCode) {
      socket.emit("joinError", "Неверный код сессии.");
      return;
    }
    if (game.phase !== "lobby") {
      socket.emit("joinError", "Игра уже началась. Дождитесь новой сессии.");
      return;
    }
    const duplicate = playerIds().some(
      (id) => game.players[id].name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      socket.emit("joinError", "Такое имя уже занято.");
      return;
    }

    const playerId = generatePersistentId();
    game.players[playerId] = {
      id: playerId,
      name: trimmed,
      userId: identity.userId,
      isGuest: identity.isGuest,
      nickname: identity.nickname,
      avatarUrl: identity.avatarUrl,
      nameMode: identity.nameMode || null,
      cards: [],
      excluded: false,
      socketId: null,
    };
    bindPlayerSocket(playerId, socket.id);
    syncInGameFromPlayers(game.players, game.phase);
    socket.emit("gameState", buildPlayerState(playerId));
    broadcast();
  });

  socket.on("leaveSession", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    if (!playerId) return;
    removePlayer(playerId);
    if (["playing", "voting", "ended"].includes(game.phase)) {
      handleAllPlayersLeft();
      if (playerIds().length > 0 && game.currentTurn === playerId) {
        advanceTurn();
      }
      if (game.phase === "voting") {
        const votersNeeded = activePlayerIds().length;
        if (Object.keys(game.votes).length >= votersNeeded) {
          resolveVoting();
        }
      }
      if (activeCount() === bunkerSpots() && game.phase !== "ended") {
        endGame();
      }
    }
    broadcast();
  });

  socket.on("updateSettings", async (payload) => {
    if (!isHostSocket(socket) || game.phase !== "setup") return;
    await applyHostSettings(payload);
    broadcast();
  });

  socket.on("kickPlayer", (playerId) => {
    if (!isHostSocket(socket) || game.phase !== "lobby") return;
    if (!game.players[playerId]) return;
    emitToPlayer(playerId, "kicked", "Ведущий исключил вас из зала ожидания.");
    removePlayer(playerId);
    broadcast();
  });

  socket.on("startGame", () => {
    if (!isHostSocket(socket) || game.phase !== "lobby") return;
    if (playerIds().length < 1) return;

    const n = playerCount();
    game.initialPlayerCount = n;
    game.phase = "playing";
    game.activeBackstory = buildActiveBackstory(game.settings, n);
    game.round = 1;

    if (
      game.settings.backstoryId &&
      catalogRuntime.isCatalogBackstoryId(game.settings.backstoryId)
    ) {
      scenarioCatalog.incrementPlayCount(game.settings.backstoryId);
    }

    const scenarioId =
      catalogRuntime.dealScenarioIdForSettings(game.settings) || game.activeBackstory.id;
    const sessionPools =
      catalogRuntime.sessionCardPoolsForSettings(game.settings) ||
      game.settings.customCardPools;
    for (const id of playerIds()) {
      game.players[id].cards = dealPlayerCards(scenarioId, sessionPools);
      game.players[id].excluded = false;
    }
    initRevealsThisRound();
    game.turnOrder = shuffleArray(activePlayerIds());
    game.currentTurn = game.turnOrder[0] || null;
    broadcast();
  });

  socket.on("castVote", (targetId) => {
    if (game.phase !== "voting") return;
    const voterId = getPlayerIdBySocket(socket.id);
    const voter = voterId ? game.players[voterId] : null;
    if (!voter || voter.excluded) return;
    if (!game.players[targetId] || game.players[targetId].excluded) return;
    if (targetId === voterId) {
      socket.emit("actionError", "Нельзя голосовать против себя.");
      return;
    }

    game.votes[voterId] = targetId;
    const votersNeeded = activePlayerIds().length;
    if (Object.keys(game.votes).length >= votersNeeded) {
      resolveVoting();
    }
    broadcast();
  });

  socket.on("rateCatalogScenario", async (payload) => {
    if (game.phase !== "ended") return;
    const playerId = getPlayerIdBySocket(socket.id);
    const player = playerId ? game.players[playerId] : null;
    if (!player?.userId) {
      socket.emit("actionError", "Войдите в аккаунт, чтобы оценить сценарий.");
      return;
    }
    const catalogId =
      game.catalogRateCatalogId ||
      scenarioCatalog.parseCatalogUuid(game.settings.backstoryId);
    if (!catalogId) return;
    const result = await scenarioCatalog.rateScenario(
      player.userId,
      catalogId,
      payload?.rating
    );
    if (!result.ok) {
      socket.emit("actionError", result.error);
      return;
    }
    game.catalogRatingsByUser = game.catalogRatingsByUser || {};
    game.catalogRatingsByUser[player.userId] = result.yourRating;
    broadcast();
  });

  socket.on("openCard", (index) => {
    if (game.phase !== "playing") return;
    const playerId = getPlayerIdBySocket(socket.id);
    const p = playerId ? game.players[playerId] : null;
    if (!p || p.excluded || game.currentTurn !== playerId) return;

    const i = Number(index);
    const card = p.cards[i];
    if (!card || card.opened) return;

    const quota = roundQuota();
    const done = game.revealsThisRound[playerId] || 0;
    if (done >= quota) {
      socket.emit("actionError", `Откройте ровно ${quota} карт за раунд. Квота выполнена.`);
      return;
    }

    if (game.round === 1 && done === 0 && card.type !== "profession") {
      socket.emit(
        "actionError",
        "В 1-м раунде первой должна быть открыта «Профессия»."
      );
      return;
    }

    card.opened = true;
    game.revealsThisRound[playerId] = done + 1;
    finishPlayerTurn(playerId);
    broadcast();
  });

  socket.on("disconnect", () => {
    if (socket.id === hostSocketId) {
      hostSocketId = null;
      return;
    }

    const playerId = unbindPlayerSocket(socket.id);
    if (!playerId) return;

    if (["playing", "voting", "ended"].includes(game.phase)) {
      if (game.currentTurn === playerId) {
        advanceTurn();
      }
      if (game.phase === "voting") {
        const votersNeeded = activePlayerIds().length;
        if (Object.keys(game.votes).length >= votersNeeded) {
          resolveVoting();
        }
      }
      if (activeCount() === bunkerSpots() && game.phase !== "ended") {
        endGame();
      }
      broadcast();
    } else {
      broadcast();
    }
  });
});

const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => loadSiteSettings())
  .then(() => scenarioCatalog.refreshPublishedCache())
  .then(() => seedNewsIfEmpty())
  .then(() => purgeOldChatMessages())
  .then(() => {
    setInterval(() => {
      purgeOldChatMessages().catch((err) =>
        console.error("chat purge:", err.message)
      );
    }, 60 * 60 * 1000);
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (process.env.DATABASE_URL) {
        console.log("Database: connected");
      }
    });
  })
  .catch((err) => {
    console.error("Database init failed:", err.message);
    console.error("Задайте DATABASE_URL (см. docs/DATABASE.md)");
    process.exit(1);
  });
