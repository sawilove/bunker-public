const socket = io();

const joinSection = document.getElementById("joinSection");
const waitingModal = document.getElementById("waitingModal");
const waitingCount = document.getElementById("waitingCount");
const waitingName = document.getElementById("waitingName");
const leaveSessionBtn = document.getElementById("leaveSessionBtn");
const backstorySection = document.getElementById("backstorySection");
const votingSection = document.getElementById("votingSection");
const votingInfo = document.getElementById("votingInfo");
const voteButtons = document.getElementById("voteButtons");
const endedSection = document.getElementById("endedSection");
const endedMessage = document.getElementById("endedMessage");
const turnSection = document.getElementById("turnSection");
const gameSection = document.getElementById("gameSection");
const joinForm = document.getElementById("joinForm");
const playerNameInput = document.getElementById("playerName");
const joinError = document.getElementById("joinError");
const lobbyList = document.getElementById("lobbyList");
const playerBadge = document.getElementById("playerBadge");
const playerTagline = document.getElementById("playerTagline");
const playerBackstoryTitle = document.getElementById("playerBackstoryTitle");
const playerBackstoryText = document.getElementById("playerBackstoryText");
const turnMessage = document.getElementById("turnMessage");
const cardsGrid = document.getElementById("cardsGrid");
const playerGreeting = document.getElementById("playerGreeting");
const excludedBadge = document.getElementById("excludedBadge");
const roundInfoEl = document.getElementById("roundInfo");

let joined = false;

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

function showError(msg) {
  joinError.textContent = msg;
  joinError.classList.toggle("hidden", !msg);
}

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;
  showError("");
  socket.emit("playerJoin", name);
});

leaveSessionBtn.addEventListener("click", () => {
  socket.emit("leaveSession");
  joined = false;
  waitingModal.classList.add("hidden");
  joinSection.classList.remove("hidden");
  playerNameInput.value = "";
  playerNameInput.focus();
});

socket.on("joinError", (msg) => showError(msg));
socket.on("actionError", (msg) => alert(msg));

socket.on("kicked", (msg) => {
  joined = false;
  alert(msg);
  window.location.reload();
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

  if (!joined) {
    joined = true;
    joinSection.classList.add("hidden");
  }

  const inLobby = state.phase === "lobby";
  const inGame = state.phase === "playing";
  const inVoting = state.phase === "voting";
  const inEnded = state.phase === "ended";

  waitingModal.classList.toggle("hidden", !inLobby);
  backstorySection.classList.toggle("hidden", inLobby);
  votingSection.classList.toggle("hidden", !inVoting);
  endedSection.classList.toggle("hidden", !inEnded);
  turnSection.classList.toggle("hidden", !inGame || state.you.excluded);
  gameSection.classList.toggle("hidden", inLobby);

  excludedBadge.classList.toggle("hidden", !state.you.excluded);

  if (inLobby) {
    playerBadge.textContent = "Зал ожидания";
    playerTagline.textContent = "Ведущий настраивает сессию.";
    waitingName.textContent = state.you.name;
    waitingCount.textContent = `Подключено игроков: ${state.playerCount}`;
    lobbyList.innerHTML = state.players
      .map((p) => {
        const tag = p.excluded ? " <span class='status-badge status-badge--excluded-inline'>ИСКЛЮЧЕН</span>" : "";
        const you = p.id === socket.id ? " <em>(вы)</em>" : "";
        return `<li>${escapeHtml(p.name)}${you}${tag}</li>`;
      })
      .join("");
    return;
  }

  if (state.backstory) {
    playerBackstoryTitle.textContent = state.backstory.title;
    playerBackstoryText.textContent = state.backstory.text;
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
