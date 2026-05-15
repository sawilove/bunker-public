const socket = io();

const joinSection = document.getElementById("joinSection");
const gameSection = document.getElementById("gameSection");
const joinForm = document.getElementById("joinForm");
const playerNameInput = document.getElementById("playerName");
const cardsGrid = document.getElementById("cardsGrid");
const playerGreeting = document.getElementById("playerGreeting");

const CARD_LABELS = ["Профессия", "Возраст", "Хобби", "Фобия"];
let myCards = [...CARD_LABELS];
let opened = [];

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;
  socket.emit("join", name);
  enterGame(name);
});

socket.on("cardOpened", ({ playerId, index }) => {
  if (playerId !== socket.id) return;
  if (opened.includes(index)) return;
  opened.push(index);
  renderMyCards();
});

function enterGame(name) {
  joinSection.classList.add("hidden");
  gameSection.classList.remove("hidden");
  playerGreeting.textContent = `Оператор: ${name}. Раскрывайте карты по правилам раунда.`;
  renderMyCards();
}

function renderMyCards() {
  cardsGrid.innerHTML = myCards
    .map((label, i) => {
      const isOpen = opened.includes(i);
      if (isOpen) {
        return `
          <div class="game-card game-card--opened">
            <span class="game-card__label">${label}</span>
            <span class="game-card__value">${label}</span>
          </div>
        `;
      }
      return `
        <button type="button" class="game-card game-card--hidden" data-index="${i}" aria-label="Раскрыть: ${label}">
          <span class="game-card__back-icon">☢</span>
          <span class="game-card__back">Засекречено</span>
        </button>
      `;
    })
    .join("");

  cardsGrid.querySelectorAll(".game-card--hidden").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.index);
      if (opened.includes(i)) return;
      openCard(i);
    });
  });
}

function openCard(i) {
  socket.emit("openCard", i);
  if (!opened.includes(i)) {
    opened.push(i);
    renderMyCards();
  }
}
