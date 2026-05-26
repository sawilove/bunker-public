(function () {
  const mount = document.querySelector("[data-site-topbar]");
  if (!mount) return;

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
        <a href="friends.html" class="site-topbar__link">Друзья</a>
        ${chip}
      </div>`;
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
        BunkerSocial.onInvite((data) => {
          const base = location.pathname.replace(/[^/]*$/, "");
          const url = `${location.origin}${base}player.html?code=${encodeURIComponent(data.code)}`;
          const el = document.createElement("div");
          el.className = "invite-toast";
          el.innerHTML = `
            <strong>${BunkerUserBadges.escapeHtml(data.fromNickname || "Игрок")}</strong> приглашает в сессию
            <code>${data.code}</code>
            <a class="btn btn--amber btn--small" href="${url}">Присоединиться</a>`;
          document.body.appendChild(el);
          setTimeout(() => el.remove(), 20000);
        });
      }
    } else {
      renderGuest();
    }
  }

  window.BunkerSiteAuth = { refresh: init };
  init();
})();
