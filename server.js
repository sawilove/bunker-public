const express = require("express");
const http = require("http");
const QRCode = require("qrcode");
const { Server } = require("socket.io");
const {
  MODES,
  BACKSTORIES,
  dealPlayerCards,
  getRevealPerRound,
  getMaxRound,
  getBunkerSpots,
  buildActiveBackstory,
  getScenarioPreview,
  shuffleArray,
  pickRandom,
} = require("./game-data");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use("/scenarios", express.static("resources/scenarios"));

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
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/host", (req, res) => {
  res.sendFile(__dirname + "/public/host.html");
});

app.get("/player", (req, res) => {
  res.sendFile(__dirname + "/public/player.html");
});

let hostSocketId = null;
let sessionCode = null;

const SESSION_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSessionCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += SESSION_CHARS[Math.floor(Math.random() * SESSION_CHARS.length)];
  }
  return code;
}

function normalizeCode(code) {
  return (code || "").trim().toUpperCase().slice(0, 6);
}

const game = {
  phase: "setup",
  settings: {
    mode: "classic",
    backstoryId: BACKSTORIES[0].id,
    backstoryRandom: false,
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

function endGame() {
  game.phase = "ended";
  game.currentTurn = null;
  revealAllCards();
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

function sanitizePlayerForHost(id, p) {
  const revealAll = game.phase === "ended";
  return {
    id,
    name: p.name,
    excluded: !!p.excluded,
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

function resetToSetup() {
  game.phase = "setup";
  sessionCode = null;
  game.players = {};
  game.currentTurn = null;
  game.activeBackstory = null;
  game.initialPlayerCount = 0;
  game.round = 1;
  game.revealsThisRound = {};
  game.turnOrder = [];
  game.votes = {};
  game.lastExcludedName = null;
}

function openLobby() {
  game.phase = "lobby";
  sessionCode = generateSessionCode();
}

function handleAllPlayersLeft() {
  if (playerIds().length > 0) return;
  if (game.phase === "ended") {
    resetToSetup();
  } else if (["playing", "voting"].includes(game.phase)) {
    resetToLobby();
  }
}

function buildHostState() {
  const n = playerIds().length;
  const active = activeCount();
  return {
    role: "host",
    phase: game.phase,
    sessionCode,
    catalog: { modes: MODES, backstories: BACKSTORIES },
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

function buildPlayerState(socketId) {
  const me = game.players[socketId];
  const quota = game.phase === "playing" ? roundQuota() : 0;
  const myReveals = game.revealsThisRound[socketId] || 0;
  const revealAll = game.phase === "ended";
  const isActive = me && !me.excluded;

  return {
    role: "player",
    phase: game.phase,
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
    voting: game.phase === "voting" ? buildVotingInfo(socketId) : null,
    settings: { mode: game.settings.mode },
    you: me
      ? {
          id: socketId,
          name: me.name,
          excluded: !!me.excluded,
          cards: me.cards.map((c) => mapCardForClient(c, revealAll)),
        }
      : null,
    players: playerIds().map((id) => ({
      id,
      name: game.players[id].name,
      excluded: !!game.players[id].excluded,
    })),
    currentTurn: game.currentTurn,
    isYourTurn: game.phase === "playing" && game.currentTurn === socketId && isActive,
    playerCount: playerIds().length,
  };
}

function emitHostState() {
  if (hostSocketId) {
    io.to(hostSocketId).emit("gameState", buildHostState());
  }
}

function emitAllPlayersState() {
  for (const id of playerIds()) {
    io.to(id).emit("gameState", buildPlayerState(id));
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
    game.players[id] = { name: game.players[id].name, cards: [], excluded: false };
  }
}

io.on("connection", (socket) => {
  socket.on("hostJoin", (payload) => {
    if (payload?.newSession || game.phase === "ended") {
      resetToSetup();
    }
    hostSocketId = socket.id;
    socket.emit("gameState", buildHostState());
  });

  socket.on("newSession", () => {
    if (socket.id !== hostSocketId) return;
    resetToSetup();
    broadcast();
  });

  socket.on("createSession", (payload) => {
    if (socket.id !== hostSocketId || game.phase !== "setup") return;
    if (payload?.mode && MODES.some((m) => m.id === payload.mode)) {
      game.settings.mode = payload.mode;
    }
    if (typeof payload?.backstoryRandom === "boolean") {
      game.settings.backstoryRandom = payload.backstoryRandom;
    }
    if (
      payload?.backstoryId &&
      BACKSTORIES.some((b) => b.id === payload.backstoryId)
    ) {
      game.settings.backstoryId = payload.backstoryId;
    }
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

  socket.on("playerJoin", (payload) => {
    const name = typeof payload === "string" ? payload : payload?.name;
    const code = typeof payload === "string" ? null : payload?.code;
    const trimmed = (name || "").trim().slice(0, 24);
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

    game.players[socket.id] = { name: trimmed, cards: [], excluded: false };
    socket.emit("gameState", buildPlayerState(socket.id));
    broadcast();
  });

  socket.on("leaveSession", () => {
    if (!game.players[socket.id]) return;
    delete game.players[socket.id];
    delete game.revealsThisRound[socket.id];
    delete game.votes[socket.id];
    if (["playing", "voting", "ended"].includes(game.phase)) {
      handleAllPlayersLeft();
      if (playerIds().length > 0 && game.currentTurn === socket.id) {
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

  socket.on("updateSettings", (payload) => {
    if (socket.id !== hostSocketId || game.phase !== "setup") return;
    if (payload.mode && MODES.some((m) => m.id === payload.mode)) {
      game.settings.mode = payload.mode;
    }
    if (typeof payload.backstoryRandom === "boolean") {
      game.settings.backstoryRandom = payload.backstoryRandom;
    }
    if (
      payload.backstoryId &&
      BACKSTORIES.some((b) => b.id === payload.backstoryId)
    ) {
      game.settings.backstoryId = payload.backstoryId;
    }
    broadcast();
  });

  socket.on("kickPlayer", (playerId) => {
    if (socket.id !== hostSocketId || game.phase !== "lobby") return;
    if (!game.players[playerId]) return;
    io.to(playerId).emit("kicked", "Ведущий исключил вас из зала ожидания.");
    delete game.players[playerId];
    broadcast();
  });

  socket.on("startGame", () => {
    if (socket.id !== hostSocketId || game.phase !== "lobby") return;
    if (playerIds().length < 1) return;

    const n = playerCount();
    game.initialPlayerCount = n;
    game.phase = "playing";
    game.activeBackstory = buildActiveBackstory(game.settings, n);
    game.round = 1;

    const scenarioId = game.activeBackstory.id;
    for (const id of playerIds()) {
      game.players[id].cards = dealPlayerCards(scenarioId);
      game.players[id].excluded = false;
    }
    initRevealsThisRound();
    game.turnOrder = shuffleArray(activePlayerIds());
    game.currentTurn = game.turnOrder[0] || null;
    broadcast();
  });

  socket.on("castVote", (targetId) => {
    if (game.phase !== "voting") return;
    const voter = game.players[socket.id];
    if (!voter || voter.excluded) return;
    if (!game.players[targetId] || game.players[targetId].excluded) return;
    if (targetId === socket.id) {
      socket.emit("actionError", "Нельзя голосовать против себя.");
      return;
    }

    game.votes[socket.id] = targetId;
    const votersNeeded = activePlayerIds().length;
    if (Object.keys(game.votes).length >= votersNeeded) {
      resolveVoting();
    }
    broadcast();
  });

  socket.on("openCard", (index) => {
    if (game.phase !== "playing") return;
    const p = game.players[socket.id];
    if (!p || p.excluded || game.currentTurn !== socket.id) return;

    const i = Number(index);
    const card = p.cards[i];
    if (!card || card.opened) return;

    const quota = roundQuota();
    const done = game.revealsThisRound[socket.id] || 0;
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
    game.revealsThisRound[socket.id] = done + 1;
    finishPlayerTurn(socket.id);
    broadcast();
  });

  socket.on("disconnect", () => {
    if (socket.id === hostSocketId) {
      hostSocketId = null;
      return;
    }

    if (!game.players[socket.id]) return;

    const wasTurn = game.currentTurn === socket.id;
    delete game.players[socket.id];
    delete game.revealsThisRound[socket.id];
    delete game.votes[socket.id];

    if (["playing", "voting", "ended"].includes(game.phase)) {
      handleAllPlayersLeft();
      if (playerIds().length > 0) {
        if (wasTurn || (game.currentTurn && !game.players[game.currentTurn])) {
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
    }

    broadcast();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
