const socket = BunkerRuntime.connectSocket();

function playerAvatarUrl(url) {
  if (!url) return BunkerRuntime.assetUrl("icons/guest-avatar.svg");
  if (url.startsWith("/uploads/") || url.startsWith("/api/avatars/")) {
    const base = (window.BUNKER_CONFIG?.apiUrl || window.BUNKER_CONFIG?.wsUrl || "").replace(
      /\/$/,
      ""
    );
    return base ? `${base}${url}` : BunkerRuntime.assetUrl(url.replace(/^\//, ""));
  }
  return BunkerRuntime.assetUrl(url.replace(/^\//, ""));
}

function playerNameHtml(p) {
  const guestBadge = p.isGuest
    ? ' <span class="player-badge player-badge--guest">Гость</span>'
    : "";
  return `${escapeHtml(p.name)}${guestBadge}`;
}

function formatBunkerHint(scenario, spots) {
  if (!scenario) return `Мест в бункере: ${spots}`;
  const loc = scenario.locationLabel || "В бункере";
  const stay = scenario.stayDurationLabel || scenario.yearsLabel;
  const area = scenario.bunkerArea ? ` · ${scenario.bunkerArea}` : "";
  const food = scenario.foodSupplyLabel ? ` · еда: ${scenario.foodSupplyLabel}` : "";
  if (stay) {
    return `${loc}: ${stay}${area}${food} · мест: ${spots}`;
  }
  return `Мест в бункере: ${spots}`;
}

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
let hostAccess = { premium: false, dev: false, loggedIn: false };
let savedCustomBackstory = null;
const communityBackstoriesById = {};
const catalogCardPoolsById = {};
const CUSTOM_BACKSTORY_ID = BunkerScenarioEditor.CUSTOM_ID;

function authTokenPayload() {
  const token = BunkerAuth.getToken?.() || "";
  return token ? { authToken: token } : {};
}

function emitHostJoin(extra = {}) {
  socket.emit("hostJoin", {
    hostId: BunkerRuntime.getHostId(),
    ...authTokenPayload(),
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
  exitModal?.classList.remove("hidden");
}

function hideExitModal() {
  exitModal?.classList.add("hidden");
}

function initHostExitFlow() {
  const exitLink =
    hostExitLink || document.querySelector("body.host a.back-link");

  if (!exitLink || !exitModal || !exitConfirmYes || !exitConfirmNo) {
    return;
  }

  exitLink.addEventListener("click", (e) => {
    if (!hasActiveHostSession()) return;
    e.preventDefault();
    showExitModal();
  });

  exitConfirmNo.addEventListener("click", hideExitModal);

  exitConfirmYes.addEventListener("click", () => {
    exitConfirmYes.disabled = true;
    socket.emit("hostEndSession");
  });
}

initHostExitFlow();

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
  const payload = {
    backstoryRandom,
    ...authTokenPayload(),
  };
  if (backstoryRandom) {
    return payload;
  }
  payload.backstoryId = selectedBackstoryId;
  if (selectedBackstoryId === CUSTOM_BACKSTORY_ID && savedCustomBackstory) {
    payload.customBackstory = savedCustomBackstory;
  }
  if (selectedBackstoryId?.startsWith?.("catalog:")) {
    payload.catalogCardPools = catalogCardPoolsById[selectedBackstoryId] || null;
  }
  return payload;
}

function syncScenarioSelection() {
  scenarioGrid.querySelectorAll(".scenario-card").forEach((card) => {
    const isRandom = card.dataset.random === "true";
    const cardId = card.dataset.id;
    const selected = isRandom
      ? backstoryRandom
      : !backstoryRandom && cardId === selectedBackstoryId;
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
  if (selectedBackstoryId === CUSTOM_BACKSTORY_ID) {
    if (savedCustomBackstory) {
      return enrichScenarioFromCatalog({
        id: CUSTOM_BACKSTORY_ID,
        ...savedCustomBackstory,
        bunkerParamsPending: true,
        bunkerParamsNote: "Параметры бункера определятся при старте игры.",
      });
    }
    return {
      isRandom: false,
      id: CUSTOM_BACKSTORY_ID,
      title: "Своя катастрофа",
      text: "Откройте редактор и заполните описание катастрофы.",
      bunkerParamsPending: true,
    };
  }
  const story =
    backstoriesById[selectedBackstoryId] || communityBackstoriesById[selectedBackstoryId];
  return story ? enrichScenarioFromCatalog(story) : null;
}

function updateHostScenarioTheme(data, showSpots = false) {
  applyScenarioBackground(data);
  renderScenarioHero(scenarioHero, data, { showSpots });
}

function canUseCustomScenario() {
  return hostAccess.premium || hostAccess.dev;
}

async function selectScenario(id, random) {
  if (!random && id === CUSTOM_BACKSTORY_ID) {
    if (!canUseCustomScenario()) {
      BunkerPremium?.open?.();
      return;
    }
    if (!savedCustomBackstory) {
      BunkerScenarioEditor.openCustomScenarioEditor(null, (custom) => {
        savedCustomBackstory = custom;
        selectedBackstoryId = CUSTOM_BACKSTORY_ID;
        backstoryRandom = false;
        syncScenarioSelection();
        updateHostScenarioTheme(getLocalScenarioPreview());
        emitSettings();
      });
      return;
    }
  }
  backstoryRandom = random;
  if (!random) selectedBackstoryId = id;
  syncScenarioSelection();
  updateHostScenarioTheme(getLocalScenarioPreview());
  emitSettings();
}

function rebuildScenarioGrid() {
  const stories = Object.values(backstoriesById);
  if (stories.length) buildScenarioGrid(stories);
}

function catalogCoverSrc(b) {
  if (!b?.coverUrl) return null;
  const base = (BunkerAuth.apiBase?.() || "").replace(/\/$/, "");
  return base ? `${base}${b.coverUrl}` : b.coverUrl;
}

function scenarioCardImgHtml(b) {
  const coverSrc = catalogCoverSrc(b);
  if (coverSrc) {
    return `<img class="scenario-card__img" src="${escapeHtml(coverSrc)}" alt="${escapeHtml(b.title)}" loading="lazy">`;
  }
  if (b.scene) {
    return `<img class="scenario-card__img" src="${BunkerRuntime.assetUrl(`scenarios/${b.scene}.png`)}" alt="${escapeHtml(b.title)}" loading="lazy">`;
  }
  return `<span class="scenario-card__random-mark" aria-hidden="true">18+</span>`;
}

function buildScenarioGrid(backstories) {
  const classicCards = backstories
    .map(
      (b) => `
    <button type="button" class="scenario-card" data-id="${b.id}" aria-selected="false"
      title="${escapeHtml(b.title)}">
      ${scenarioCardImgHtml(b)}
      <span class="scenario-card__label">${escapeHtml(b.title)}</span>
    </button>`
    )
    .join("");

  const communityList = Object.values(communityBackstoriesById);
  const catalogSection =
    hostAccess.loggedIn && communityList.length
      ? `<p class="scenario-grid__section-title">Каталог</p>${communityList
          .map(
            (b) => `
    <button type="button" class="scenario-card scenario-card--catalog" data-id="${escapeHtml(b.id)}" aria-selected="false"
      title="${escapeHtml(b.title)}">
      ${scenarioCardImgHtml(b)}
      <span class="scenario-card__label">${escapeHtml(b.title)}</span>
    </button>`
          )
          .join("")}`
      : hostAccess.loggedIn
        ? `<p class="scenario-grid__hint">В каталоге пока нет одобренных сценариев.</p>`
        : `<p class="scenario-grid__hint">Войдите в аккаунт, чтобы выбирать сценарии из каталога.</p>`;

  const cards = classicCards;

  const randomCard = `
    <button type="button" class="scenario-card scenario-card--random" data-random="true" aria-selected="false"
      title="Случайный сценарий">
      <span class="scenario-card__random-mark" aria-hidden="true">?</span>
      <span class="scenario-card__label">Случайный</span>
    </button>`;

  const customCard = BunkerScenarioEditor.customScenarioCardHtml(canUseCustomScenario());
  const mineBtn = canUseCustomScenario()
    ? `<button type="button" class="btn btn--small" data-my-scenarios>Мои сценарии</button>`
    : "";
  const devTools = hostAccess.dev
    ? `<div class="host-dev-tools">
        <button type="button" class="btn btn--small" data-dev-edit-scenarios>Редактировать сценарии</button>
        <button type="button" class="btn btn--small" data-dev-edit-pools>Паки характеристик</button>
      </div>`
    : "";

  scenarioGrid.innerHTML =
    cards + catalogSection + customCard + randomCard + mineBtn + devTools;

  scenarioGrid.querySelectorAll(".scenario-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.classList.contains("scenario-card--locked")) {
        BunkerPremium?.open?.();
        return;
      }
      if (card.dataset.random === "true") {
        selectScenario(null, true);
      } else {
        selectScenario(card.dataset.id, false);
      }
    });
    if (
      card.dataset.id === CUSTOM_BACKSTORY_ID &&
      canUseCustomScenario() &&
      !card.classList.contains("scenario-card--locked")
    ) {
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        BunkerScenarioEditor.openCustomScenarioEditor(savedCustomBackstory, (custom) => {
          savedCustomBackstory = custom;
          if (selectedBackstoryId === CUSTOM_BACKSTORY_ID) {
            updateHostScenarioTheme(getLocalScenarioPreview());
            emitSettings();
          }
        });
      });
    }
  });

  scenarioGrid.querySelector("[data-dev-edit-scenarios]")?.addEventListener("click", () => {
    BunkerScenarioEditor.openDevScenariosEditor();
  });
  scenarioGrid.querySelector("[data-dev-edit-pools]")?.addEventListener("click", () => {
    BunkerScenarioEditor.openDevCardPoolsEditor();
  });
  scenarioGrid.querySelector("[data-my-scenarios]")?.addEventListener("click", () => {
    BunkerScenarioEditor.openMyScenarios?.();
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
    catalogReady = true;
    rebuildScenarioGrid();

    createSessionBtn.addEventListener("click", () => {
      socket.emit("createSession", currentSettingsPayload());
    });
    startBtn.addEventListener("click", () => socket.emit("startGame"));
    newSessionBtn.addEventListener("click", () => {
      BunkerRuntime.saveHostId("");
      socket.emit("newSession");
    });
  }

  if (catalog.communityBackstories) {
    for (const key of Object.keys(communityBackstoriesById)) {
      delete communityBackstoriesById[key];
    }
    catalog.communityBackstories.forEach((b) => {
      communityBackstoriesById[b.id] = b;
      if (b.cardPools) catalogCardPoolsById[b.id] = b.cardPools;
    });
    if (catalogReady) rebuildScenarioGrid();
  }

  suppressSettingsEmit = true;
  backstoryRandom = !!settings.backstoryRandom;
  if (backstoryRandom) {
    selectedBackstoryId = settings.backstoryId || selectedBackstoryId;
  } else {
    selectedBackstoryId = settings.backstoryId || selectedBackstoryId;
  }
  if (settings.customBackstory) savedCustomBackstory = settings.customBackstory;
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
      <img class="player-chip__avatar" src="${playerAvatarUrl(p.avatarUrl)}" alt="">
      <span class="lobby-row__name">${playerNameHtml(p)}</span>
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
            <img class="player-chip__avatar player-row__avatar" src="${playerAvatarUrl(p.avatarUrl)}" alt="">
            <h2 class="player-row__name">
              ${playerNameHtml(p)}
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
    bunkerHint.textContent = state.scenario?.bunkerParamsPending
      ? `${state.scenario.bunkerParamsNote || "Параметры бункера — при старте"} · мест: ${state.bunkerSpots}`
      : formatBunkerHint(state.scenario, state.bunkerSpots);
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
  bunkerHint.textContent = state.backstory
    ? `${formatBunkerHint(state.backstory, state.bunkerSpots)} · выживших: ${state.survivorsCount}`
    : `Мест в бункере: ${state.bunkerSpots} · выживших: ${state.survivorsCount}`;

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

async function loadHostAccess() {
  if (!BunkerAuth.apiBase?.()) {
    hostAccess = { premium: false, dev: false, loggedIn: false };
    rebuildScenarioGrid();
    syncScenarioSelection();
    return;
  }
  if (!BunkerAuth.getToken?.()) {
    hostAccess = { premium: false, dev: false, loggedIn: false };
    rebuildScenarioGrid();
    syncScenarioSelection();
    return;
  }
  try {
    const user = await BunkerAuth.fetchMe();
    if (!user) {
      hostAccess = { premium: false, dev: false, loggedIn: false };
    } else {
      hostAccess = {
        premium: !!user.premium,
        dev: !!user.dev,
        loggedIn: true,
      };
      if (hostAccess.premium || hostAccess.dev) {
        const data = await BunkerAuth.getCustomScenario();
        savedCustomBackstory = data.customBackstory || null;
      }
    }
  } catch {
    hostAccess = { premium: false, dev: false, loggedIn: false };
  }
  rebuildScenarioGrid();
  syncScenarioSelection();
  emitHostJoin();
}

loadHostAccess();
window.addEventListener("bunker:auth-ready", () => {
  loadHostAccess();
});
