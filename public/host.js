const socket = io();

const rosterEl = document.getElementById("roster");
const statusEl = document.getElementById("hostStatus");

function renderPlayers(players) {
  const ids = Object.keys(players);

  if (ids.length === 0) {
    rosterEl.innerHTML =
      '<p class="roster-empty">Пока никого нет. Игроки заходят с личного терминала.</p>';
    statusEl.textContent = "Ожидание подключений…";
    return;
  }

  statusEl.textContent = `В зоне ожидания: ${ids.length} чел.`;

  rosterEl.innerHTML = ids
    .map((id) => {
      const p = players[id];
      const cardsHtml = p.cards
        .map((label, i) => {
          const revealed = p.opened.includes(i);
          return revealed
            ? `<span class="host-card host-card--revealed">
                <span class="host-card__type host-card__type--revealed">Раскрыто</span>
                ${escapeHtml(label)}
              </span>`
            : `<span class="host-card host-card--sealed" data-card-label="${escapeHtml(label)}">██ ${escapeHtml(label)}</span>`;
        })
        .join("");

      return `
        <article class="player-row" data-player-id="${id}">
          <h2 class="player-row__name">${escapeHtml(p.name)}</h2>
          <div class="player-row__cards">${cardsHtml}</div>
        </article>
      `;
    })
    .join("");
}

function showCardOnScreen(playerId, index) {
  const row = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!row) return;
  const card = row.querySelectorAll(".host-card")[index];
  if (!card || card.classList.contains("host-card--revealed")) return;
  const label = card.dataset.cardLabel || "—";
  card.className = "host-card host-card--revealed";
  card.innerHTML = `
    <span class="host-card__type host-card__type--revealed">Раскрыто</span>
    ${escapeHtml(label)}
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

socket.on("playersUpdate", renderPlayers);
socket.on("cardOpened", ({ playerId, index }) => {
  showCardOnScreen(playerId, index);
});
