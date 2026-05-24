const socket = BunkerRuntime.connectSocket();

const hostBadge = document.getElementById("hostBadge");
const hostTagline = document.getElementById("hostTagline");
const hostStatus = document.getElementById("hostStatus");
const setupPanel = document.getElementById("setupPanel");
const lobbyPanel = document.getElementById("lobbyPanel");
const rosterPanel = document.getElementById("rosterPanel");
const scenarioHero = document.getElementById("scenarioHero");
const roundPanel = document.getElementById("roundPanel");
const votingPanel = document.getElementById("votingPanel");
const endedPanel = document.getElementById("endedPanel");
const turnPanel = document.getElementById("turnPanel");
const rosterTitle = document.getElementById("rosterTitle");
const rosterEl = document.getElementById("roster");
const scenarioGrid = document.getElementById("scenarioGrid");
const createSessionBtn = document.getElementById("createSessionBtn");
const setupBunkerHint = document.getElementById("setupBunkerHint");
const startBtn = document.getElementById("startBtn");
const bunkerHint = document.getElementById("bunkerHint");
const hostRoundInfo = document.getElementById("hostRoundInfo");
const hostVotingInfo = document.getElementById("hostVotingInfo");
const hostEndedInfo = document.getElementById("hostEndedInfo");
const currentTurnName = document.getElementById("currentTurnName");
const sessionCodeDisplay = document.getElementById("sessionCodeDisplay");
const qrImg = document.getElementById("qrCode");
const newSessionBtn = document.getElementById("newSessionBtn");
const hostExitLink = document.getElementById("hostExitLink");
const exitModal = document.getElementById("exitModal");
const exitConfirmYes = document.getElementById("exitConfirmYes");
const exitConfirmNo = document.getElementById("exitConfirmNo");

let catalogReady = false;
let hostPhase = "setup";
let lastQrUrl = "";
let suppressSettingsEmit = false;
let selectedBackstoryId = "nuclear";
let backstoryRandom = false;
const backstoriesById = {};

function emitHostJoin(extra = {}) {
  socket.emit("hostJoin", {
    hostId: BunkerRuntime.getHostId(),
    ...extra,
  });
}

emitHostJoin();

socket.on("connect", () => {
  emitHostJoin();
});

function hasActiveHostSession() {
  return hostPhase !== "setup";
}

function showExitModal() {
  exitModal.classList.remove("hidden");
}

function hideExitModal() {
  exitModal.classList.add("hidden");
}

hostExitLink.addEventListener("click", (e) => {
  if (!hasActiveHostSession()) return;
  e.preventDefault();
  showExitModal();
});

exitConfirmNo.addEventListener("click", hideExitModal);

exitConfirmYes.addEventListener("click", () => {
  exitConfirmYes.disabled = true;
  socket.emit("hostEndSession");
});

socket.on("hostSessionEnded", () => {
  BunkerRuntime.saveHostId("");
  window.location.href = BunkerRuntime.pageUrl("index.html");
});

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

function currentSettingsPayload() {
  return {
    backstoryId: selectedBackstoryId,
    backstoryRandom,
  };
}

function syncScenarioSelection() {
  scenarioGrid.querySelectorAll(".scenario-card").forEach((card) => {
    const isRandom = card.dataset.random === "true";
    const selected = isRandom
      ? backstoryRandom
      : !backstoryRandom && card.dataset.id === selectedBackstoryId;
    card.classList.toggle("scenario-card--selected", selected);
    card.setAttribute("aria-selected", selected ? "true" : "false");
  });
}

function getLocalScenarioPreview() {
  if (backstoryRandom) {
    return {
      isRandom: true,
      title: "Случайный сценарий",
      text: "Катастрофа будет выбрана при старте. Описание увидите здесь после выбора.",
    };
  }
  const story = backstoriesById[selectedBackstoryId];
  return story ? enrichScenarioFromCatalog(story) : null;
}

function updateHostScenarioTheme(data, showSpots = false) {
  applyScenarioBackground(data);
  renderScenarioHero(scenarioHero, data, { showSpots });
}

function selectScenario(id, random) {
  backstoryRandom = random;
  if (!random) selectedBackstoryId = id;
  syncScenarioSelection();
  updateHostScenarioTheme(getLocalScenarioPreview());
  emitSettings();
}

function buildScenarioGrid(backstories) {
  const cards = backstories
    .map(
      (b) => `
    <button type="button" class="scenario-card" data-id="${b.id}" aria-selected="false"
      title="${escapeHtml(b.title)}">
      ${b.scene ? `<img class="scenario-card__img" src="${BunkerRuntime.assetUrl(`scenarios/${b.scene}.png`)}" alt="${escapeHtml(b.title)}" loading="lazy">` : `<span class="scenario-card__random-mark" aria-hidden="true">18+</span>`}
      <span class="scenario-card__label">${escapeHtml(b.title)}</span>
    </button>`
    )
    .join("");

  const randomCard = `
    <button type="button" class="scenario-card scenario-card--random" data-random="true" aria-selected="false"
      title="Случайный сценарий">
      <span class="scenario-card__random-mark" aria-hidden="true">?</span>
      <span class="scenario-card__label">Случайный</span>
    </button>`;

  scenarioGrid.innerHTML = cards + randomCard;

  scenarioGrid.querySelectorAll(".scenario-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.random === "true") {
        selectScenario(null, true);
      } else {
        selectScenario(card.dataset.id, false);
      }
    });
  });
}

function emitSettings() {
  if (suppressSettingsEmit) return;
  socket.emit("updateSettings", currentSettingsPayload());
}

function fillCatalog(catalog, settings) {
  if (!catalogReady) {
    catalog.backstories.forEach((b) => {
      backstoriesById[b.id] = b;
    });
    buildScenarioGrid(catalog.backstories);
    catalogReady = true;

    createSessionBtn.addEventListener("click", () => {
      socket.emit("createSession", currentSettingsPayload());
    });
    startBtn.addEventListener("click", () => socket.emit("startGame"));
    newSessionBtn.addEventListener("click", () => {
      BunkerRuntime.saveHostId("");
      socket.emit("newSession");
    });
  }

  suppressSettingsEmit = true;
  selectedBackstoryId = settings.backstoryId;
  backstoryRandom = settings.backstoryRandom;
  syncScenarioSelection();
  updateHostScenarioTheme(getLocalScenarioPreview());
  suppressSettingsEmit = false;
}

function updateInvitePanel(code) {
  if (!code) return;
  sessionCodeDisplay.textContent = code;
  const url = BunkerRuntime.playerJoinUrl(code);
  if (url === lastQrUrl) return;
  lastQrUrl = url;
  qrImg.src = BunkerRuntime.qrImageUrl(url);
  qrImg.alt = "QR-код для входа игрока";
}

function renderLobbyRoster(players) {
  if (players.length === 0) {
    rosterEl.innerHTML =
      '<p class="roster-empty">Пока никого нет. Игроки подключаются по QR-коду или коду сессии.</p>';
    return;
  }

  rosterEl.innerHTML = players
    .map(
      (p) => `
    <article class="lobby-row">
      <span class="lobby-row__name">${escapeHtml(p.name)}</span>
      <button type="button" class="btn btn--danger btn--small" data-kick="${p.id}">Исключить</button>
    </article>
  `
    )
    .join("");

  rosterEl.querySelectorAll("[data-kick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      socket.emit("kickPlayer", btn.dataset.kick);
    });
  });
}

function renderGameRoster(players, currentTurn, round, phase) {
  const quota = round?.revealQuota ?? 0;
  const revealAll = phase === "ended";

  rosterEl.innerHTML = players
    .map((p) => {
      const isTurn = p.id === currentTurn && phase === "playing";
      const excludedTag = p.excluded
        ? '<span class="status-badge status-badge--excluded-inline">ИСКЛЮЧЕН</span>'
        : "";

      const cardsHtml = p.cards
        .map((c, idx) => {
          if (c.opened && c.value) {
            return `
              <span class="host-card host-card--revealed">
                <span class="host-card__header">${escapeHtml(c.label)}</span>
                <span class="host-card__value">${escapeHtml(formatCardValue(c))}</span>
              </span>`;
          }
          if (revealAll) return "";
          return `<span class="host-card host-card--sealed">${idx + 1}</span>`;
        })
        .join("");

      return `
        <article class="player-row ${isTurn ? "player-row--turn" : ""} ${p.excluded ? "player-row--excluded" : ""}" data-player-id="${p.id}">
          <div class="player-row__header">
            <h2 class="player-row__name">
              ${escapeHtml(p.name)}
              ${excludedTag}
              ${isTurn ? '<span class="turn-chip">ход</span>' : ""}
            </h2>
            <span class="player-row__meta">${p.revealsThisRound ?? 0}/${quota}</span>
          </div>
          <div class="player-row__body">
            <div class="player-row__cards">${cardsHtml || '<span class="host-card host-card--sealed">—</span>'}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function applyState(state) {
  fillCatalog(state.catalog, state.settings);
  hostPhase = state.phase;

  const inSetup = state.phase === "setup";
  const inLobby = state.phase === "lobby";
  const inPlaying = state.phase === "playing";
  const inVoting = state.phase === "voting";
  const inEnded = state.phase === "ended";
  const inGame = inPlaying || inVoting || inEnded;
  const n = state.players.length;

  setupPanel.classList.toggle("hidden", !inSetup);
  lobbyPanel.classList.toggle("hidden", !inLobby);
  rosterPanel.classList.toggle("hidden", !inLobby && !inGame);
  roundPanel.classList.toggle("hidden", !inPlaying);
  votingPanel.classList.toggle("hidden", !inVoting);
  endedPanel.classList.toggle("hidden", !inEnded);
  turnPanel.classList.toggle("hidden", !inPlaying && !inVoting);

  if (inSetup) {
    hostBadge.textContent = "Настройка";
    hostTagline.textContent =
      "Выберите сценарий катастрофы, затем создайте сессию.";
    hostStatus.textContent = "Сессия ещё не создана";
    setupBunkerHint.textContent = `Мест в бункере (при 6 игроках): ${state.bunkerSpots}`;
    updateHostScenarioTheme(getLocalScenarioPreview());
    return;
  }

  if (inLobby) {
    hostBadge.textContent = "Зал ожидания";
    rosterTitle.textContent = "Игроки в зале ожидания";
    const scenarioHint = state.scenario?.isRandom
      ? "Случайный сценарий"
      : state.scenario?.title || "Сценарий";
    hostTagline.textContent =
      `«${scenarioHint}». Дождитесь игроков — рекомендуется 6–15 человек.`;
    hostStatus.textContent =
      n === 0 ? "Ожидание подключений…" : `В зале: ${n} чел.`;
    const loc = state.scenario?.locationLabel || "В бункере";
    bunkerHint.textContent = state.scenario?.yearsLabel
      ? `${loc}: ${state.scenario.yearsLabel} · мест по таблице: ${state.bunkerSpots}`
      : `Мест в бункере: ${state.bunkerSpots}`;
    startBtn.disabled = !state.canStart;
    updateHostScenarioTheme(state.scenario);
    if (state.sessionCode) {
      if (state.sessionCode !== sessionCodeDisplay.textContent) {
        lastQrUrl = "";
      }
      updateInvitePanel(state.sessionCode);
    }
    renderLobbyRoster(state.players);
    return;
  }

  hostBadge.textContent = inEnded
    ? "Игра окончена"
    : inVoting
      ? "Голосование"
      : `Раунд ${state.round?.number ?? 1}`;
  rosterTitle.textContent = "Игроки";

  updateHostScenarioTheme(state.backstory, true);

  hostStatus.textContent = `В бункере мест: ${state.bunkerSpots} · выживших: ${state.survivorsCount}`;
  bunkerHint.textContent = `Мест в бункере: ${state.bunkerSpots} · выживших: ${state.survivorsCount}`;

  if (inPlaying && state.round) {
    hostTagline.textContent =
      "Карты скрыты до раскрытия. В 1-м раунде первой — «Профессия». После квоты — голосование.";
    hostRoundInfo.textContent = `Раунд ${state.round.number} из ${state.round.max}. Каждый активный игрок открывает ${state.round.revealQuota} карт.${state.round.number === 1 ? " Первая — «Профессия»." : ""}`;
    if (state.round.allMetQuota) {
      currentTurnName.textContent = "ГОЛОСОВАНИЕ";
      currentTurnName.className = "turn-banner__name turn-banner__name--voting";
    } else {
      const turnPlayer = state.players.find((p) => p.id === state.currentTurn);
      currentTurnName.textContent = turnPlayer ? turnPlayer.name : "—";
      currentTurnName.className = "turn-banner__name";
    }
  }

  if (inVoting && state.voting) {
    hostTagline.textContent = "Игроки голосуют, кого исключить.";
    hostVotingInfo.textContent = `Голосов: ${state.voting.votesCast} / ${state.voting.votersNeeded}.${state.voting.lastExcludedName ? ` Последний исключённый: ${state.voting.lastExcludedName}.` : ""}`;
    currentTurnName.textContent = "ГОЛОСОВАНИЕ";
    currentTurnName.className = "turn-banner__name turn-banner__name--voting";
  }

  if (inEnded) {
    hostTagline.textContent = "В бункере нужное число выживших. Все карты раскрыты.";
    hostEndedInfo.textContent = `Финал: ${state.survivorsCount} игрок(ов) в бункере при ${state.bunkerSpots} местах.`;
    currentTurnName.textContent = "—";
  }

  renderGameRoster(state.players, state.currentTurn, state.round, state.phase);
}

socket.on("gameState", (state) => {
  if (state.hostId) BunkerRuntime.saveHostId(state.hostId);
  applyState(state);
});

socket.on("hostError", (msg) => {
  alert(msg || "Не удалось подключиться как ведущий.");
});
