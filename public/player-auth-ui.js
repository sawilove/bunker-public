/** UI аккаунта на странице игрока */
(function () {
  const accountBar = document.getElementById("accountBar");
  const accountBarText = document.getElementById("accountBarText");
  const accountBarLink = document.getElementById("accountBarLink");
  const guestJoinFields = document.getElementById("guestJoinFields");
  const memberJoinFields = document.getElementById("memberJoinFields");
  const memberNicknameLabel = document.getElementById("memberNicknameLabel");
  const sessionNameField = document.getElementById("sessionNameField");
  const sessionNameInput = document.getElementById("sessionName");
  const playerNameInput = document.getElementById("playerName");
  const waitingAvatar = document.getElementById("waitingAvatar");
  const waitingBadge = document.getElementById("waitingBadge");

  let currentUser = null;

  function avatarUrl(path) {
    if (window.BunkerAuth) return BunkerAuth.assetUrl(path || "/icons/guest-avatar.svg");
    return path || "icons/guest-avatar.svg";
  }

  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str;
    return el.innerHTML;
  }

  function renderPlayerChip(p, opts = {}) {
    const guestBadge = p.isGuest
      ? '<span class="player-badge player-badge--guest">Гость</span>'
      : "";
    const av = avatarUrl(p.avatarUrl);
    const you = opts.you ? " <em class='player-chip__you'>(вы)</em>" : "";
    const excl = opts.excluded
      ? " <span class='status-badge status-badge--excluded-inline'>ИСКЛЮЧЕН</span>"
      : "";
    return `
      <li class="lobby-list__item player-chip">
        <img class="player-chip__avatar" src="${av}" alt="">
        <span class="player-chip__name">${escapeHtml(p.name)}${you}${excl}</span>
        ${guestBadge}
      </li>`;
  }

  function updateJoinForm() {
    const loggedIn = !!currentUser;
    guestJoinFields.classList.toggle("hidden", loggedIn);
    memberJoinFields.classList.toggle("hidden", !loggedIn);
    if (loggedIn) {
      memberNicknameLabel.textContent = currentUser.nickname;
      playerNameInput.removeAttribute("required");
    } else {
      playerNameInput.setAttribute("required", "");
    }
    updateSessionNameVisibility();
  }

  function updateSessionNameVisibility() {
    const mode = document.querySelector('input[name="nameMode"]:checked')?.value;
    const useSession = mode === "session";
    sessionNameField.classList.toggle("hidden", !useSession);
    if (useSession) sessionNameInput.setAttribute("required", "");
    else sessionNameInput.removeAttribute("required");
  }

  function updateAccountBar() {
    if (!accountBar) return;
    if (currentUser) {
      accountBarText.textContent = `Аккаунт: ${currentUser.nickname}`;
      accountBarLink.textContent = "Профиль";
    } else {
      accountBarText.textContent = "Вход не выполнен — вы войдёте как гость.";
      accountBarLink.textContent = "Войти";
    }
  }

  function updateWaitingYou(you) {
    if (!you) return;
    if (waitingAvatar) {
      waitingAvatar.src = avatarUrl(you.avatarUrl);
    }
    if (waitingBadge) {
      waitingBadge.classList.toggle("hidden", !you.isGuest);
      waitingBadge.textContent = "Гость";
    }
  }

  function buildJoinPayload(code) {
    const base = { code };
    if (!currentUser) {
      return { ...base, name: playerNameInput.value.trim() };
    }
    const nameMode =
      document.querySelector('input[name="nameMode"]:checked')?.value || "nickname";
    return {
      ...base,
      authToken: BunkerAuth.getToken(),
      nameMode,
      name: nameMode === "session" ? sessionNameInput.value.trim() : "",
    };
  }

  document.querySelectorAll('input[name="nameMode"]').forEach((el) => {
    el.addEventListener("change", updateSessionNameVisibility);
  });

  async function initAccount() {
    if (!window.BunkerAuth || !BunkerAuth.apiBase()) {
      updateAccountBar();
      updateJoinForm();
      return;
    }
    currentUser = await BunkerAuth.fetchMe();
    updateAccountBar();
    updateJoinForm();
  }

  window.BunkerPlayerAuth = {
    initAccount,
    buildJoinPayload,
    renderPlayerChip,
    updateWaitingYou,
    getCurrentUser: () => currentUser,
  };
})();
