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
  let lobbyOccupantIds = new Set();
  let friendsLoadPromise = null;

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
    const nameInner = `${escapeHtml(p.name)}${you}${excl}`;
    const nameEl = p.userId
      ? `<a class="player-chip__name player-chip__name--link" href="${BunkerAuth.profileUrl(p.userId)}">${nameInner}</a>`
      : `<button type="button" class="player-chip__name player-chip__name--btn" data-profile-guest="${escapeHtml(p.name)}" data-profile-avatar="${escapeHtml(p.avatarUrl || "")}">${nameInner}</button>`;
    return `
      <li class="lobby-list__item player-chip">
        <img class="player-chip__avatar" src="${av}" alt="">
        ${nameEl}
        ${guestBadge}
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

  function setLobbyOccupants(userIds) {
    lobbyOccupantIds = new Set((userIds || []).filter(Boolean));
    loadLobbyFriends();
  }

  function renderInviteList() {
    if (!lobbyInviteSection || !lobbyInviteList) return;
    const available = lobbyFriends.filter((f) => !lobbyOccupantIds.has(f.id));
    if (available.length === 0) {
      lobbyInviteSection.classList.add("hidden");
      return;
    }
    lobbyInviteSection.classList.remove("hidden");
    lobbyInviteList.innerHTML = available
      .map(
        (f) => `
        <li class="lobby-invite__item">
          <img class="lobby-invite__avatar" src="${avatarUrl(f.avatarUrl)}" alt="">
          <span class="lobby-invite__name">${escapeHtml(f.nickname)}</span>
          <button type="button" class="btn btn--small btn--amber" data-invite-friend="${f.id}">Пригласить</button>
        </li>`
      )
      .join("");
  }

  async function loadLobbyFriends() {
    if (!lobbyInviteSection || !window.BunkerAuth?.getToken()) {
      lobbyInviteSection?.classList.add("hidden");
      return;
    }

    if (!document.body.classList.contains("player--lobby")) {
      return;
    }

    if (friendsLoadPromise) {
      await friendsLoadPromise;
      renderInviteList();
      return;
    }

    friendsLoadPromise = (async () => {
      try {
        if (!currentUser) {
          currentUser = await BunkerAuth.fetchMe();
        }
        if (!currentUser) {
          lobbyInviteSection.classList.add("hidden");
          return;
        }
        const data = await BunkerAuth.getFriends();
        lobbyFriends = data.friends || [];
        renderInviteList();
      } catch {
        lobbyInviteSection.classList.add("hidden");
      } finally {
        friendsLoadPromise = null;
      }
    })();

    await friendsLoadPromise;
  }

  function handleProfileClick(e) {
    const guestBtn = e.target.closest("[data-profile-guest]");
    if (guestBtn && window.BunkerProfileModal) {
      BunkerProfileModal.showGuest(
        guestBtn.dataset.profileGuest,
        guestBtn.dataset.profileAvatar
      );
    }
  }

  document.body.addEventListener("click", (e) => {
    if (e.target.closest("[data-profile-guest]")) {
      e.preventDefault();
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
    if (document.body.classList.contains("player--lobby")) {
      loadLobbyFriends();
    }
  }

  window.BunkerPlayerAuth = {
    initAccount,
    buildJoinPayload,
    renderPlayerChip,
    updateWaitingYou,
    loadLobbyFriends,
    setLobbyOccupants,
    getCurrentUser: () => currentUser,
  };
})();
