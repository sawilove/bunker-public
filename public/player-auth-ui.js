/** UI аккаунта на странице игрока */
(function () {
  const guestJoinFields = document.getElementById("guestJoinFields");
  const memberJoinFields = document.getElementById("memberJoinFields");
  const memberCallsignInput = document.getElementById("memberCallsign");
  const playerNameInput = document.getElementById("playerName");
  const waitingAvatar = document.getElementById("waitingAvatar");
  const waitingBadge = document.getElementById("waitingBadge");
  const lobbyInviteSection = document.getElementById("lobbyInviteSection");
  const lobbyInviteList = document.getElementById("lobbyInviteList");

  let currentUser = null;
  let lobbyFriends = [];

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
    const profileBtn = p.userId
      ? `<button type="button" class="player-chip__profile btn btn--small" data-profile-user="${p.userId}" data-profile-name="${escapeHtml(p.name)}">Профиль</button>`
      : `<button type="button" class="player-chip__profile btn btn--small" data-profile-guest="${escapeHtml(p.name)}" data-profile-avatar="${escapeHtml(p.avatarUrl || "")}">Профиль</button>`;
    return `
      <li class="lobby-list__item player-chip">
        <img class="player-chip__avatar" src="${av}" alt="">
        <span class="player-chip__name">${escapeHtml(p.name)}${you}${excl}</span>
        ${guestBadge}
        ${profileBtn}
      </li>`;
  }

  function updateJoinForm() {
    const loggedIn = !!currentUser;
    guestJoinFields.classList.toggle("hidden", loggedIn);
    memberJoinFields.classList.toggle("hidden", !loggedIn);
    if (loggedIn && memberCallsignInput) {
      memberCallsignInput.placeholder = `По умолчанию: ${currentUser.nickname}`;
      playerNameInput.removeAttribute("required");
      memberCallsignInput.removeAttribute("required");
    } else {
      playerNameInput.setAttribute("required", "");
    }
  }

  function updateWaitingYou(you) {
    if (!you) return;
    if (waitingAvatar) waitingAvatar.src = avatarUrl(you.avatarUrl);
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
    return {
      ...base,
      authToken: BunkerAuth.getToken(),
      name: memberCallsignInput?.value.trim() || "",
    };
  }

  async function loadLobbyFriends() {
    if (!currentUser || !lobbyInviteSection || !BunkerAuth.getToken()) {
      lobbyInviteSection?.classList.add("hidden");
      return;
    }
    try {
      const data = await BunkerAuth.getFriends();
      lobbyFriends = data.friends || [];
      if (lobbyFriends.length === 0) {
        lobbyInviteSection.classList.add("hidden");
        return;
      }
      lobbyInviteSection.classList.remove("hidden");
      lobbyInviteList.innerHTML = lobbyFriends
        .map(
          (f) => `
        <li class="lobby-invite__item">
          <img class="lobby-invite__avatar" src="${avatarUrl(f.avatarUrl)}" alt="">
          <span class="lobby-invite__name">${escapeHtml(f.nickname)}</span>
          <button type="button" class="btn btn--small btn--amber" data-invite-friend="${f.id}">Пригласить</button>
        </li>`
        )
        .join("");
    } catch {
      lobbyInviteSection.classList.add("hidden");
    }
  }

  function handleProfileClick(e) {
    const userId = e.target.closest("[data-profile-user]")?.dataset.profileUser;
    const guestBtn = e.target.closest("[data-profile-guest]");
    if (userId && window.BunkerProfileModal) {
      const name = e.target.closest("[data-profile-user]")?.dataset.profileName;
      BunkerProfileModal.showUser(userId, name);
      return;
    }
    if (guestBtn && window.BunkerProfileModal) {
      BunkerProfileModal.showGuest(
        guestBtn.dataset.profileGuest,
        guestBtn.dataset.profileAvatar
      );
    }
  }

  document.body.addEventListener("click", (e) => {
    if (e.target.closest("[data-profile-user], [data-profile-guest]")) {
      handleProfileClick(e);
    }
    const inviteId = e.target.closest("[data-invite-friend]")?.dataset.inviteFriend;
    if (inviteId && window.BunkerSocial) {
      BunkerSocial.inviteToSession(inviteId);
      e.target.textContent = "Отправлено";
      e.target.disabled = true;
    }
  });

  async function initAccount() {
    if (!window.BunkerAuth || !BunkerAuth.apiBase()) {
      updateJoinForm();
      return;
    }
    currentUser = await BunkerAuth.fetchMe();
    updateJoinForm();
    if (currentUser && window.BunkerSocial) BunkerSocial.connect();
  }

  window.BunkerPlayerAuth = {
    initAccount,
    buildJoinPayload,
    renderPlayerChip,
    updateWaitingYou,
    loadLobbyFriends,
    getCurrentUser: () => currentUser,
  };
})();
