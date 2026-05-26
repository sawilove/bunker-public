(function () {
  const mount = document.querySelector("[data-site-topbar]");
  if (!mount) return;

  const FRIENDS_ICON = `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

  function renderGuest() {
    mount.innerHTML = `
      <div class="site-topbar__inner">
        <a href="account.html?tab=login" class="site-topbar__link">Вход</a>
        <a href="account.html?tab=register" class="site-topbar__btn btn btn--amber btn--small">Регистрация</a>
      </div>`;
  }

  function renderUser(user) {
    const chip = BunkerUserBadges.renderUserChip(user, {
      href: "account.html",
      showBadges: true,
    });
    mount.innerHTML = `
      <div class="site-topbar__inner site-topbar__inner--user">
        <a href="friends.html" class="site-topbar__friends" title="Друзья">${FRIENDS_ICON}</a>
        ${chip}
      </div>`;
  }

  function bindInviteToast() {
    if (!window.BunkerSocial) return;
    BunkerSocial.onInvite((data) => {
      const base = location.pathname.replace(/[^/]*$/, "");
      const url = `${location.origin}${base}player.html?code=${encodeURIComponent(data.code)}`;
      const el = document.createElement("div");
      el.className = "invite-toast";
      el.innerHTML = `
        <strong>${BunkerUserBadges.escapeHtml(data.fromNickname || "Игрок")}</strong> приглашает в игру
        <code>${data.code}</code>
        <a class="btn btn--amber btn--small" href="${url}">Присоединиться</a>
        <button type="button" class="invite-toast__close" aria-label="Закрыть">×</button>`;
      el.querySelector(".invite-toast__close").onclick = () => el.remove();
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 20000);
    });
  }

  async function init() {
    if (!window.BunkerAuth || !BunkerAuth.apiBase()) {
      renderGuest();
      return;
    }
    const user = await BunkerAuth.fetchMe();
    if (user) {
      renderUser(user);
      if (window.BunkerSocial) {
        BunkerSocial.connect();
        bindInviteToast();
      }
    } else {
      renderGuest();
    }
  }

  window.BunkerSiteAuth = { refresh: init };
  init();
})();
