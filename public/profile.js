(function () {
  const content = document.getElementById("profilePageContent");
  const title = document.getElementById("profilePageTitle");
  const tagline = document.getElementById("profilePageTagline");

  function getUserIdFromUrl() {
    const params = new URLSearchParams(location.search);
    if (params.get("id")) return params.get("id");
    const m = location.pathname.match(/\/user\/([a-f0-9]{32})\/?$/i);
    return m ? m[1] : null;
  }

  function renderProfile(user) {
    const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");
    const frame = BunkerUserBadges.frameClass(user);
    title.textContent = user.nickname;
    tagline.textContent = user.bio?.trim() || "Профиль игрока";
    document.title = `Бункер — ${user.nickname}`;

    const chatBtn =
      window.BunkerChatWidget && BunkerAuth.getToken()
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
        ${chatBtn}
        <a href="friends.html" class="btn">К друзьям</a>
      </div>`;

    content.querySelector("[data-open-chat]")?.addEventListener("click", () => {
      BunkerChatWidget.open(user.id, user.nickname);
    });
  }

  async function init() {
    const userId = getUserIdFromUrl();
    if (!userId) {
      content.innerHTML = '<p class="form-error">Не указан id игрока.</p>';
      tagline.textContent = "Откройте профиль по ссылке с id.";
      return;
    }

    if (!BunkerAuth.apiBase()) {
      content.innerHTML =
        '<p class="form-error">API не настроен. Укажите apiUrl в config.js.</p>';
      return;
    }

    if (!BunkerAuth.getToken()) {
      location.href = `account.html?tab=login&next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }

    try {
      const data = await BunkerAuth.fetchUser(userId);
      renderProfile(data.user);
    } catch (err) {
      content.innerHTML = `<p class="form-error">${BunkerUserBadges.escapeHtml(err.message)}</p>`;
      tagline.textContent = "Не удалось загрузить профиль.";
    }
  }

  init();
})();
