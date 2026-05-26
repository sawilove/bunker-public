(function () {
  let overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "profile-modal hidden";
    overlay.innerHTML = `
      <div class="profile-modal__card panel" role="dialog" aria-modal="true">
        <button type="button" class="profile-modal__close" aria-label="Закрыть">×</button>
        <div class="profile-modal__body"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".profile-modal__close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    return overlay;
  }

  function close() {
    overlay?.classList.add("hidden");
  }

  function renderBody(user, displayName) {
    const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");
    const frame = BunkerUserBadges.frameClass(user);
    const name = displayName || user.nickname;
    return `
      <div class="profile-modal__header ${frame}">
        <img class="profile-modal__avatar" src="${av}" alt="">
        <div>
          <h2 class="profile-modal__name">${BunkerUserBadges.escapeHtml(name)}</h2>
          ${user.nickname && name !== user.nickname ? `<p class="profile-modal__nick">@${BunkerUserBadges.escapeHtml(user.nickname)}</p>` : ""}
          <div class="profile-badges">${BunkerUserBadges.roleBadgesHtml(user)}</div>
          ${BunkerUserBadges.statusHtml(user)}
        </div>
      </div>
      <div class="profile-modal__stats">
        <span>Игр: <strong>${user.gamesPlayed ?? 0}</strong></span>
        <span>Выживаний: <strong>${user.bunkerSurvivals ?? 0}</strong></span>
      </div>
      ${user.bio ? `<p class="profile-modal__bio">${BunkerUserBadges.escapeHtml(user.bio)}</p>` : '<p class="profile-modal__bio profile-modal__bio--empty">Без описания</p>'}
      <p class="profile-modal__link"><a href="${BunkerAuth.profileUrl(user)}" class="btn btn--small btn--amber">Открыть профиль</a></p>`;
  }

  function showGuest(name, avatarUrl) {
    const el = ensureOverlay();
    const av = BunkerAuth?.assetUrl(avatarUrl || "/icons/guest-avatar.svg") || avatarUrl;
    el.querySelector(".profile-modal__body").innerHTML = `
      <div class="profile-modal__header">
        <img class="profile-modal__avatar" src="${av}" alt="">
        <div>
          <h2 class="profile-modal__name">${BunkerUserBadges.escapeHtml(name)}</h2>
          <span class="player-badge player-badge--guest">Гость</span>
        </div>
      </div>`;
    el.classList.remove("hidden");
  }

  async function showUser(userId, displayName) {
    const el = ensureOverlay();
    el.querySelector(".profile-modal__body").innerHTML = "<p>Загрузка…</p>";
    el.classList.remove("hidden");
    try {
      const data = await BunkerAuth.fetchUser(userId);
      el.querySelector(".profile-modal__body").innerHTML = renderBody(data.user, displayName);
    } catch (err) {
      el.querySelector(".profile-modal__body").innerHTML = `<p class="form-error">${BunkerUserBadges.escapeHtml(err.message)}</p>`;
    }
  }

  window.BunkerProfileModal = { showUser, showGuest, close };
})();
