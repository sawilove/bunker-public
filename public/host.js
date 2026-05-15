const socket = io();

const hostBadge = document.getElementById("hostBadge");
const hostTagline = document.getElementById("hostTagline");
const hostStatus = document.getElementById("hostStatus");
const lobbyPanel = document.getElementById("lobbyPanel");
const backstoryPanel = document.getElementById("backstoryPanel");
const roundPanel = document.getElementById("roundPanel");
const votingPanel = document.getElementById("votingPanel");
const endedPanel = document.getElementById("endedPanel");
const turnPanel = document.getElementById("turnPanel");
const rosterTitle = document.getElementById("rosterTitle");
const rosterEl = document.getElementById("roster");
const modeSelect = document.getElementById("modeSelect");
const backstorySelect = document.getElementById("backstorySelect");
const backstoryRandom = document.getElementById("backstoryRandom");
const backstoryField = document.getElementById("backstoryField");
const startBtn = document.getElementById("startBtn");
const bunkerHint = document.getElementById("bunkerHint");
const backstoryTitle = document.getElementById("backstoryTitle");
const backstoryText = document.getElementById("backstoryText");
const hostRoundInfo = document.getElementById("hostRoundInfo");
const hostVotingInfo = document.getElementById("hostVotingInfo");
const hostEndedInfo = document.getElementById("hostEndedInfo");
const currentTurnName = document.getElementById("currentTurnName");

let catalogReady = false;
let suppressSettingsEmit = false;

socket.emit("hostJoin");

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str;
  return el.innerHTML;
}

function formatCardValue(c) {
  if (c.type === "profession" && c.professionLevel) {
    return `${c.profession || c.value} — ${c.professionLevel}`;
  }
  return c.value;
}

function emitSettings() {
  if (suppressSettingsEmit) return;
  socket.emit("updateSettings", {
    mode: modeSelect.value,
    backstoryId: backstorySelect.value,
    backstoryRandom: backstoryRandom.checked,
  });
}

function fillCatalog(catalog, settings) {
  if (!catalogReady) {
    modeSelect.innerHTML = catalog.modes
      .map(
        (m) =>
          `<option value="${m.id}">${escapeHtml(m.name)} — ${escapeHtml(m.description)}</option>`
      )
      .join("");
    backstorySelect.innerHTML = catalog.backstories
      .map((b) => `<option value="${b.id}">${escapeHtml(b.title)}</option>`)
      .join("");
    catalogReady = true;

    modeSelect.addEventListener("change", emitSettings);
    backstorySelect.addEventListener("change", emitSettings);
    backstoryRandom.addEventListener("change", () => {
      backstoryField.classList.toggle("hidden", backstoryRandom.checked);
      emitSettings();
    });
    startBtn.addEventListener("click", () => socket.emit("startGame"));
  }

  suppressSettingsEmit = true;
  modeSelect.value = settings.mode;
  backstorySelect.value = settings.backstoryId;
  backstoryRandom.checked = settings.backstoryRandom;
  backstoryField.classList.toggle("hidden", settings.backstoryRandom);
  suppressSettingsEmit = false;
}

function renderLobbyRoster(players) {
  if (players.length === 0) {
    rosterEl.innerHTML =
      '<p class="roster-empty">Пока никого нет. Игроки заходят с личного терминала.</p>';
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
                <span class="host-card__type host-card__type--revealed">${escapeHtml(c.label)}</span>
                ${escapeHtml(formatCardValue(c))}
              </span>`;
          }
          if (revealAll) return "";
          return `<span class="host-card host-card--sealed">██ ${idx + 1}</span>`;
        })
        .join("");

      return `
        <article class="player-row ${isTurn ? "player-row--turn" : ""} ${p.excluded ? "player-row--excluded" : ""}" data-player-id="${p.id}">
          <h2 class="player-row__name">
            ${escapeHtml(p.name)}
            ${excludedTag}
            ${isTurn ? '<span class="turn-chip">ход</span>' : ""}
          </h2>
          <p class="player-row__meta">Раскрыто в раунде: ${p.revealsThisRound ?? 0} / ${quota}</p>
          <div class="player-row__cards">${cardsHtml || '<span class="host-card host-card--sealed">—</span>'}</div>
        </article>
      `;
    })
    .join("");
}

function applyState(state) {
  fillCatalog(state.catalog, state.settings);

  const inLobby = state.phase === "lobby";
  const inPlaying = state.phase === "playing";
  const inVoting = state.phase === "voting";
  const inEnded = state.phase === "ended";
  const n = state.players.length;

  lobbyPanel.classList.toggle("hidden", !inLobby);
  backstoryPanel.classList.toggle("hidden", inLobby);
  roundPanel.classList.toggle("hidden", !inPlaying);
  votingPanel.classList.toggle("hidden", !inVoting);
  endedPanel.classList.toggle("hidden", !inEnded);
  turnPanel.classList.toggle("hidden", !inPlaying);

  bunkerHint.textContent = `Мест в бункере: ${state.bunkerSpots} · выживших: ${state.survivorsCount}`;

  if (inLobby) {
    hostBadge.textContent = "Зал ожидания";
    rosterTitle.textContent = "Игроки в зале ожидания";
    hostTagline.textContent =
      "Настройте сессию и дождитесь игроков. Рекомендуется 6–15 человек.";
    hostStatus.textContent =
      n === 0 ? "Ожидание подключений…" : `В зале: ${n} чел.`;
    startBtn.disabled = !state.canStart;
    renderLobbyRoster(state.players);
    return;
  }

  hostBadge.textContent = inEnded
    ? "Игра окончена"
    : inVoting
      ? "Голосование"
      : `Раунд ${state.round?.number ?? 1}`;
  rosterTitle.textContent = "Игроки";

  if (state.backstory) {
    backstoryTitle.textContent = state.backstory.title;
    backstoryText.textContent = state.backstory.text;
  }

  const modeName =
    state.catalog.modes.find((m) => m.id === state.settings.mode)?.name ||
    state.settings.mode;
  hostStatus.textContent = `${modeName} · в бункере мест: ${state.bunkerSpots} · выживших: ${state.survivorsCount}`;

  if (inPlaying && state.round) {
    hostTagline.textContent =
      "Карты скрыты до раскрытия. В 1-м раунде первой — «Профессия». После квоты — голосование.";
    hostRoundInfo.textContent = `Раунд ${state.round.number} из ${state.round.max}. Каждый активный игрок открывает ${state.round.revealQuota} карт.${state.round.number === 1 ? " Первая — «Профессия»." : ""}`;
    const turnPlayer = state.players.find((p) => p.id === state.currentTurn);
    currentTurnName.textContent = turnPlayer ? turnPlayer.name : "—";
  }

  if (inVoting && state.voting) {
    hostTagline.textContent = "Игроки голосуют, кого исключить.";
    hostVotingInfo.textContent = `Голосов: ${state.voting.votesCast} / ${state.voting.votersNeeded}.${state.voting.lastExcludedName ? ` Последний исключённый: ${state.voting.lastExcludedName}.` : ""}`;
    currentTurnName.textContent = "—";
  }

  if (inEnded) {
    hostTagline.textContent = "В бункере нужное число выживших. Все карты раскрыты.";
    hostEndedInfo.textContent = `Финал: ${state.survivorsCount} игрок(ов) в бункере при ${state.bunkerSpots} местах.`;
    currentTurnName.textContent = "—";
  }

  renderGameRoster(state.players, state.currentTurn, state.round, state.phase);
}

socket.on("gameState", applyState);
