const socket = BunkerRuntime.connectSocket();

const codeSection = document.getElementById("codeSection");
const joinSection = document.getElementById("joinSection");
const codeForm = document.getElementById("codeForm");
const sessionCodeInput = document.getElementById("sessionCodeInput");
const codeError = document.getElementById("codeError");
const joinedSessionCode = document.getElementById("joinedSessionCode");
const waitingModal = document.getElementById("waitingModal");
const waitingCount = document.getElementById("waitingCount");
const waitingName = document.getElementById("waitingName");
const leaveSessionBtn = document.getElementById("leaveSessionBtn");
const scenarioHero = document.getElementById("scenarioHero");
const votingSection = document.getElementById("votingSection");
const votingInfo = document.getElementById("votingInfo");
const voteButtons = document.getElementById("voteButtons");
const endedSection = document.getElementById("endedSection");
const endedMessage = document.getElementById("endedMessage");
const catalogRateWrap = document.getElementById("catalogRateWrap");
const turnSection = document.getElementById("turnSection");
const gameSection = document.getElementById("gameSection");
const joinForm = document.getElementById("joinForm");
const playerNameInput = document.getElementById("playerName");
const joinError = document.getElementById("joinError");
const lobbyList = document.getElementById("lobbyList");
const playerBadge = document.getElementById("playerBadge");
const playerTagline = document.getElementById("playerTagline");
const turnMessage = document.getElementById("turnMessage");
const cardsGrid = document.getElementById("cardsGrid");
const playerGreeting = document.getElementById("playerGreeting");
const excludedBadge = document.getElementById("excludedBadge");
const roundInfoEl = document.getElementById("roundInfo");

let joined = false;
let validatedCode = null;
let manualCodeFlow = false;

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str;
  return el.innerHTML;
}

function formatCardValue(c) {
  if (c.type === "profession" && c.professionLevel) {
    return `${c.profession || c.value} — ${c.professionLevel}`;
  }
  if (c.type === "health" && c.condition) {
    return `${c.condition} — ${c.conditionLevel}`;
  }
  return c.value;
}

function normalizeCodeInput(value) {
  return (value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function isPlayerEntryPath(pathname) {
  const path = (pathname || location.pathname).replace(/\\/g, "/");
  return path === "/player" || path === "/player.html";
}

function getCodeFromUrl() {
  const params = new URLSearchParams(location.search);
  let code = normalizeCodeInput(params.get("code"));
  if (code.length === 6) return code;
  const match = location.pathname.match(/\/game\/([^/?#]+)\/?$/i);
  if (match) code = normalizeCodeInput(decodeURIComponent(match[1]));
  return code.length === 6 ? code : "";
}

function redirectToGameUrl(code) {
  const normalized = normalizeCodeInput(code);
  if (normalized.length !== 6) return;
  const targetPath = `/game/${encodeURIComponent(normalized)}`;
  const currentPath = location.pathname.replace(/\\/g, "/");
  if (currentPath.toUpperCase() === targetPath.toUpperCase()) return;
  location.replace(BunkerRuntime.playerJoinUrl(normalized));
}

function showCodeError(msg) {
  codeError.textContent = msg;
  codeError.classList.toggle("hidden", !msg);
}

function showJoinError(msg) {
  joinError.textContent = msg;
  joinError.classList.toggle("hidden", !msg);
}

function updatePlayerScenarioTheme(data, showSpots = false) {
  applyScenarioBackground(data);
  renderScenarioHero(scenarioHero, data, { showSpots, hideText: true });
}

function clearPlayerScenarioTheme() {
  clearScenarioBackground();
  renderScenarioHero(scenarioHero, null);
}

function showNameForm(code) {
  validatedCode = code;
  joinedSessionCode.textContent = code;
  codeSection.classList.add("hidden");
  joinSection.classList.remove("hidden");
  playerNameInput.focus();
}

function requestCodeValidation(code) {
  manualCodeFlow = true;
  const saved = BunkerRuntime.getPlayerSession();
  if (saved.code && saved.code !== code) {
    BunkerRuntime.clearPlayerSession();
  }
  showCodeError("");
  socket.emit("validateSessionCode", code);
}

codeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = normalizeCodeInput(sessionCodeInput.value);
  if (code.length !== 6) {
    showCodeError("Введите 6-значный код.");
    return;
  }
  requestCodeValidation(code);
});

sessionCodeInput.addEventListener("input", () => {
  sessionCodeInput.value = normalizeCodeInput(sessionCodeInput.value);
});

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validatedCode) return;
  showJoinError("");
  const payload = window.BunkerPlayerAuth
    ? BunkerPlayerAuth.buildJoinPayload(validatedCode)
    : { name: playerNameInput.value.trim(), code: validatedCode };

  if (!window.BunkerAuth?.isLoggedIn()) {
    if (!payload.name?.trim()) {
      showJoinError("Введите имя.");
      return;
    }
  } else if (payload.nameMode === "session" && !payload.name?.trim()) {
    showJoinError("Введите имя для этой сессии.");
    return;
  }

  socket.emit("playerJoin", payload);
});

leaveSessionBtn.addEventListener("click", () => {
  socket.emit("leaveSession");
  joined = false;
  validatedCode = null;
  BunkerRuntime.clearPlayerSession();
  clearPlayerScenarioTheme();
  document.body.classList.remove("player--lobby", "player--in-game");
  waitingModal.classList.add("hidden");
  joinSection.classList.add("hidden");
  codeSection.classList.remove("hidden");
  playerNameInput.value = "";
  sessionCodeInput.value = "";
  sessionCodeInput.focus();
});

socket.on("sessionCodeResult", ({ valid, reason, code }) => {
  if (valid) {
    showNameForm(code);
    return;
  }
  if (reason === "not_ready") {
    showCodeError("Ведущий ещё не создал сессию. Подождите.");
  } else if (reason === "started") {
    showCodeError("Игра уже началась. Дождитесь новой сессии.");
  } else {
    showCodeError("Неверный код сессии.");
  }
});

socket.on("joinError", (msg) => showJoinError(msg));
socket.on("actionError", (msg) => alert(msg));

socket.on("kicked", (msg) => {
  joined = false;
  validatedCode = null;
  BunkerRuntime.clearPlayerSession();
  alert(msg);
  window.location.reload();
});

socket.on("sessionEnded", (msg) => {
  joined = false;
  validatedCode = null;
  BunkerRuntime.clearPlayerSession();
  clearPlayerScenarioTheme();
  document.body.classList.remove("player--lobby", "player--in-game");
  waitingModal.classList.add("hidden");
  joinSection.classList.add("hidden");
  gameSection.classList.add("hidden");
  votingSection.classList.add("hidden");
  endedSection.classList.add("hidden");
  turnSection.classList.add("hidden");
  codeSection.classList.remove("hidden");
  showCodeError(msg || "Ведущий завершил сессию.");
  sessionCodeInput.focus();
});

socket.on("reconnectFailed", (msg) => {
  BunkerRuntime.clearPlayerSession();
  joined = false;
  validatedCode = null;
  showCodeError(msg || "Не удалось восстановить сессию.");
  codeSection.classList.remove("hidden");
  joinSection.classList.add("hidden");
  waitingModal.classList.add("hidden");
});

function renderCards(cards, isYourTurn, round, phase, excluded) {
  const remaining = round?.remaining ?? 0;
  const canReveal = phase === "playing" && isYourTurn && !excluded && remaining > 0;
  const revealAll = phase === "ended";

  cardsGrid.innerHTML = cards
    .map((c, i) => {
      const onTable = c.opened;
      const revealBtn =
        canReveal && !onTable
          ? `<button type="button" class="game-card__reveal-btn" data-index="${i}">На стол</button>`
          : "";

      const levelLine =
        c.type === "profession" && c.professionLevel
          ? `<span class="game-card__level">Уровень: ${escapeHtml(c.professionLevel)}</span>`
          : c.type === "health" && c.conditionLevel
            ? `<span class="game-card__level">Степень: ${escapeHtml(c.conditionLevel)}</span>`
            : "";

      return `
        <div class="game-card game-card--private ${onTable ? "game-card--on-table" : ""} ${revealAll && !onTable ? "game-card--revealed-end" : ""}">
          <span class="game-card__label">${escapeHtml(c.label)}</span>
          <span class="game-card__value">${escapeHtml(formatCardValue(c))}</span>
          ${levelLine}
          ${onTable ? '<span class="game-card__table-badge">На столе</span>' : revealBtn}
          ${revealAll && !onTable ? '<span class="game-card__table-badge">Раскрыто</span>' : ""}
        </div>`;
    })
    .join("");

  cardsGrid.querySelectorAll(".game-card__reveal-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      socket.emit("openCard", Number(btn.dataset.index));
    });
  });
}

function renderCatalogRating(cr) {
  if (!catalogRateWrap) return;
  if (!cr?.catalogId) {
    catalogRateWrap.classList.add("hidden");
    catalogRateWrap.innerHTML = "";
    return;
  }
  catalogRateWrap.classList.remove("hidden");
  const title = cr.title || "Сценарий катастрофы";
  const avg =
    cr.ratingAvg != null
      ? `Средняя оценка: ★ ${Number(cr.ratingAvg).toFixed(1)} (${cr.ratingCount || 0})`
      : "Пока нет оценок";
  if (!window.BunkerAuth?.isLoggedIn?.() || !cr.canRate) {
    catalogRateWrap.innerHTML = `<p class="scenario-rate__scene"><strong>${escapeHtml(title)}</strong></p>
      <p class="scenario-rate__hint">${escapeHtml(avg)}. Войдите в аккаунт, чтобы поставить оценку после игры.</p>`;
    return;
  }
  if (cr.yourRating != null) {
    catalogRateWrap.innerHTML = `<p class="scenario-rate__scene"><strong>${escapeHtml(title)}</strong></p>
      <p class="scenario-rate__hint">${escapeHtml(avg)}</p>
      <p class="scenario-rate__thanks">Ваша оценка: ★ ${cr.yourRating}</p>`;
    return;
  }
  catalogRateWrap.innerHTML = `<p class="scenario-rate__scene"><strong>${escapeHtml(title)}</strong></p>
    <p class="scenario-rate__hint">${escapeHtml(avg)}</p>
    ${BunkerScenarioCatalogUi.renderStarRating(cr.catalogId, null, false)}`;
  BunkerScenarioCatalogUi.bindStarRating(catalogRateWrap, async (rating) => {
    if (socket?.connected) {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Нет ответа сервера.")), 8000);
        const onState = (st) => {
          if (st?.catalogRating?.yourRating != null) {
            clearTimeout(t);
            socket.off("gameState", onState);
            resolve();
          }
        };
        socket.on("gameState", onState);
        socket.emit("rateCatalogScenario", { rating });
      });
    }
    await BunkerAuth.rateCatalogScenario(cr.catalogId, rating);
  });
}

function renderVoting(voting) {
  if (!voting?.canVote) {
    voteButtons.innerHTML = "<p class='round-info'>Вы не участвуете в голосовании.</p>";
    return;
  }
  if (voting.myVote) {
    voteButtons.innerHTML = "<p class='round-info'>Ваш голос учтён. Ожидайте остальных.</p>";
    return;
  }
  voteButtons.innerHTML = voting.targets
    .map(
      (t) =>
        `<button type="button" class="btn btn--danger" data-vote="${t.id}">Исключить: ${escapeHtml(t.name)}</button>`
    )
    .join("");

  voteButtons.querySelectorAll("[data-vote]").forEach((btn) => {
    btn.addEventListener("click", () => {
      socket.emit("castVote", btn.dataset.vote);
    });
  });
}

function applyState(state) {
  if (!state.you) return;

  if (
    state.sessionCode &&
    ["playing", "voting", "ended"].includes(state.phase) &&
    isPlayerEntryPath()
  ) {
    redirectToGameUrl(state.sessionCode);
    return;
  }

  if (state.sessionCode && state.you.id) {
    BunkerRuntime.savePlayerSession({
      playerId: state.you.id,
      code: state.sessionCode,
      name: state.you.name,
    });
    validatedCode = state.sessionCode;
  }

  if (!joined) {
    joined = true;
    codeSection.classList.add("hidden");
    joinSection.classList.add("hidden");
  }

  const inLobby = state.phase === "lobby";
  const inGame = state.phase === "playing";
  const inVoting = state.phase === "voting";
  const inEnded = state.phase === "ended";

  document.body.classList.toggle("player--lobby", inLobby);
  document.body.classList.toggle("player--in-game", inGame || inVoting || inEnded);

  waitingModal.classList.toggle("hidden", !inLobby);
  votingSection.classList.toggle("hidden", !inVoting);
  endedSection.classList.toggle("hidden", !inEnded);
  if (!inEnded) renderCatalogRating(null);
  turnSection.classList.toggle("hidden", !inGame || state.you.excluded);
  gameSection.classList.toggle("hidden", inLobby);

  excludedBadge.classList.toggle("hidden", !state.you.excluded);

  const scenarioData = inLobby ? state.scenario : state.backstory;
  if (scenarioData) {
    updatePlayerScenarioTheme(scenarioData, !inLobby);
  } else {
    clearPlayerScenarioTheme();
  }

  if (inLobby) {
    playerBadge.textContent = "Зал ожидания";
    playerTagline.textContent = state.scenario?.isRandom
      ? "Сценарий откроется при старте игры."
      : "Дождитесь старта — детали катастрофы объявит ведущий.";
    waitingName.textContent = state.you.name;
    if (window.BunkerPlayerAuth) BunkerPlayerAuth.updateWaitingYou(state.you);
    waitingCount.textContent = `Подключено игроков: ${state.playerCount}`;
    lobbyList.innerHTML = state.players
      .map((p) =>
        window.BunkerPlayerAuth
          ? BunkerPlayerAuth.renderPlayerChip(p, {
              you: p.id === state.you.id,
              excluded: p.excluded,
            })
          : `<li>${escapeHtml(p.name)}</li>`
      )
      .join("");
    if (window.BunkerPlayerAuth?.setLobbyOccupants) {
      BunkerPlayerAuth.setLobbyOccupants(
        state.players.map((p) => p.userId).filter(Boolean)
      );
    }
    return;
  }

  playerGreeting.textContent = `${state.you.name} · в бункере мест: ${state.bunkerSpots} · выживших: ${state.survivorsCount}`;

  if (inVoting && state.voting) {
    playerBadge.textContent = "Голосование";
    playerTagline.textContent = "Проголосуйте, кого исключить из бункера.";
    votingInfo.textContent = `Голосов: ${state.voting.votesCast} / ${state.voting.votersNeeded}. В бункере осталось мест: ${state.bunkerSpots}.`;
    renderVoting(state.voting);
    renderCards(state.you.cards, false, null, state.phase, state.you.excluded);
    return;
  }

  if (inEnded) {
    playerBadge.textContent = "Финал";
    playerTagline.textContent = "Все карты раскрыты.";
    const survived = !state.you.excluded;
    endedMessage.textContent = survived
      ? "Вы в бункере! Все характеристики открыты."
      : "Вы исключены. Все характеристики открыты для разбора.";
    renderCatalogRating(state.catalogRating);
    renderCards(state.you.cards, false, null, state.phase, state.you.excluded);
    return;
  }

  playerBadge.textContent = `Раунд ${state.round?.number ?? 1}`;
  if (roundInfoEl && state.round) {
    roundInfoEl.textContent = state.you.excluded
      ? "Вы исключены и не участвуете в раунде."
      : `Раунд ${state.round.number}/${state.round.max}: на столе ${state.round.myReveals}/${state.round.revealQuota}. Осталось открыть: ${state.round.remaining}.`;
  }

  const turnPlayer = state.players.find((p) => p.id === state.currentTurn);
  if (state.you.excluded) {
    playerTagline.textContent = "Вы исключены, но остаётесь в сессии.";
    turnMessage.textContent = "Наблюдение";
  } else if (state.isYourTurn) {
    turnSection.classList.add("turn-banner--active");
    const needProfession =
      state.round?.number === 1 && state.round.myReveals === 0;
    turnMessage.textContent = needProfession
      ? "Ваш ход — сначала «Профессия» на стол. Нужно открыть все карты по квоте раунда."
      : `Ваш ход. Откройте на стол ещё ${state.round?.remaining ?? 0} карт.`;
    playerTagline.textContent =
      "Обязательно откройте все карты по квоте. Ход перейдёт автоматически.";
  } else {
    turnSection.classList.remove("turn-banner--active");
    turnMessage.textContent = turnPlayer
      ? `Сейчас ходит: ${turnPlayer.name}`
      : "Ожидание хода…";
    playerTagline.textContent = "Дождитесь своего хода.";
  }

  renderCards(state.you.cards, state.isYourTurn, state.round, state.phase, state.you.excluded);
}

socket.on("gameState", applyState);

function tryReconnect() {
  if (manualCodeFlow) return false;
  const saved = BunkerRuntime.getPlayerSession();
  if (saved.playerId && saved.code) {
    socket.emit("playerReconnect", {
      playerId: saved.playerId,
      code: saved.code,
    });
    return true;
  }
  return false;
}

socket.on("connect", () => {
  if (!joined) tryReconnect();
});

const urlCode = getCodeFromUrl();
const savedSession = BunkerRuntime.getPlayerSession();
if (urlCode) {
  sessionCodeInput.value = urlCode;
  if (savedSession.playerId && savedSession.code === urlCode) {
    manualCodeFlow = false;
  } else {
    manualCodeFlow = true;
    if (savedSession.code && savedSession.code !== urlCode) {
      BunkerRuntime.clearPlayerSession();
    }
    requestCodeValidation(urlCode);
  }
} else if (!savedSession.playerId) {
  sessionCodeInput.focus();
}

if (window.BunkerPlayerAuth) {
  BunkerPlayerAuth.initAccount();
}
