(function () {
  const content = document.getElementById("profilePageContent");
  const title = document.getElementById("profilePageTitle");
  const tagline = document.getElementById("profilePageTagline");

  let currentUserId = null;
  let friendship = "none";

  function getUserIdFromUrl() {
    const params = new URLSearchParams(location.search);
    if (params.get("id")) return params.get("id");
    const m = location.pathname.match(/\/user\/([a-f0-9]{32})\/?$/i);
    return m ? m[1] : null;
  }

  function renderFriendRow(user) {
    const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");
    const profileHref = BunkerAuth.profileUrl(user.id);
    return `
      <li class="profile-friends__item ${BunkerUserBadges.frameClass(user)}">
        <a href="${profileHref}" class="profile-friends__link">
          <img class="profile-friends__avatar" src="${av}" alt="">
          <span class="profile-friends__name">${BunkerUserBadges.escapeHtml(user.nickname)}</span>
        </a>
      </li>`;
  }

  function renderFriendsList(friends) {
    if (!friends?.length) {
      return `<p class="profile-friends__empty">Пока нет друзей.</p>`;
    }
    return `<ul class="profile-friends">${friends.map(renderFriendRow).join("")}</ul>`;
  }

  function friendActionHtml(userId) {
    if (friendship === "self") {
      return `<a href="account.html" class="btn btn--amber">Редактировать профиль</a>`;
    }
    if (friendship === "friends") {
      return "";
    }
    if (friendship === "outgoing") {
      return `<span class="profile-friend-status">Заявка отправлена</span>`;
    }
    if (friendship === "incoming") {
      return `
        <button type="button" class="btn btn--amber" data-accept-friend="${userId}">Принять заявку</button>
        <button type="button" class="btn" data-decline-friend="${userId}">Отклонить</button>`;
    }
    return `<button type="button" class="btn btn--amber" data-add-friend="${userId}">Добавить в друзья</button>`;
  }

  function renderProfile(user, friends) {
    const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");
    const frame = BunkerUserBadges.frameClass(user);
    title.textContent = user.nickname;
    tagline.textContent = user.bio?.trim() || "Профиль игрока";
    document.title = `Бункер — ${user.nickname}`;

    const chatBtn =
      friendship === "friends" && window.BunkerChatWidget && BunkerAuth.getToken()
        ? `<button type="button" class="btn btn--amber" data-open-chat="${user.id}">Написать</button>`
        : "";

    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar-wrap ${frame}">
          <img class="profile-avatar" src="${av}" alt="">
        </div>
        <div class="profile-header__info">
          <h2 class="profile-nickname">${BunkerUserBadges.escapeHtml(user.nickname)}</h2>
          <div class="profile-badges">${BunkerUserBadges.roleBadgesHtml(user)}</div>
          ${BunkerUserBadges.statusHtml(user)}
          <div class="profile-stats">
            <span class="profile-stat">Игр: <strong>${user.gamesPlayed ?? 0}</strong></span>
            <span class="profile-stat">Выживаний: <strong>${user.bunkerSurvivals ?? 0}</strong></span>
          </div>
        </div>
      </div>
      <div class="profile-view__bio">
        <span class="field__label">О себе</span>
        <p class="profile-bio-text">${user.bio?.trim() ? BunkerUserBadges.escapeHtml(user.bio) : "—"}</p>
      </div>
      <div class="profile-view__actions">
        ${friendActionHtml(user.id)}
        ${chatBtn}
        <a href="friends.html" class="btn">К друзьям</a>
      </div>
      <p id="profileFriendError" class="form-error hidden"></p>
      <div class="profile-view__friends">
        <span class="field__label">Друзья</span>
        ${renderFriendsList(friends)}
      </div>`;

    content.querySelector("[data-open-chat]")?.addEventListener("click", () => {
      BunkerChatWidget.open(user.id, user.nickname);
    });

    content.querySelector("[data-add-friend]")?.addEventListener("click", onAddFriend);
    content.querySelector("[data-accept-friend]")?.addEventListener("click", onAcceptFriend);
    content.querySelector("[data-decline-friend]")?.addEventListener("click", onDeclineFriend);
  }

  function showFriendError(msg) {
    const el = content.querySelector("#profileFriendError");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  async function reloadProfile() {
    const data = await BunkerAuth.fetchUser(currentUserId);
    friendship = data.friendship || "none";
    renderProfile(data.user, data.friends || []);
  }

  async function onAddFriend() {
    showFriendError("");
    try {
      await BunkerAuth.requestFriendById(currentUserId);
      await reloadProfile();
    } catch (err) {
      showFriendError(err.message);
    }
  }

  async function onAcceptFriend() {
    showFriendError("");
    try {
      await BunkerAuth.respondFriend(currentUserId, true);
      await reloadProfile();
    } catch (err) {
      showFriendError(err.message);
    }
  }

  async function onDeclineFriend() {
    showFriendError("");
    try {
      await BunkerAuth.respondFriend(currentUserId, false);
      await reloadProfile();
    } catch (err) {
      showFriendError(err.message);
    }
  }

  async function init() {
    const userId = getUserIdFromUrl();
    if (!userId) {
      content.innerHTML = '<p class="form-error">Не указан id игрока.</p>';
      tagline.textContent = "Откройте профиль по ссылке с id.";
      return;
    }

    currentUserId = userId;

    if (!BunkerAuth.apiBase()) {
      content.innerHTML =
        '<p class="form-error">API не настроен. Укажите apiUrl в config.js.</p>';
      return;
    }

    if (!BunkerAuth.getToken()) {
      const next = BunkerAuth.pageUrl(
        `profile.html?id=${encodeURIComponent(userId)}`
      );
      location.href = BunkerAuth.pageUrl(
        `account.html?tab=login&next=${encodeURIComponent(next)}`
      );
      return;
    }

    try {
      const data = await BunkerAuth.fetchUser(userId);
      friendship = data.friendship || "none";
      renderProfile(data.user, data.friends || []);
    } catch (err) {
      content.innerHTML = `<p class="form-error">${BunkerUserBadges.escapeHtml(err.message)}</p>`;
      tagline.textContent = "Не удалось загрузить профиль.";
    }
  }

  init();
})();
