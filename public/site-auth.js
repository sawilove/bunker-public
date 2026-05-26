(function () {
  const mount = document.querySelector("[data-site-topbar]");
  if (!mount) return;

  const ICONS = {
    friends: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    bell: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    news: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  };

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
    const devBtn = user.dev
      ? `<button type="button" class="site-topbar__dev-btn" data-dev-panel title="Служебные настройки">&lt;/&gt;</button>`
      : "";
    mount.innerHTML = `
      <div class="site-topbar__inner site-topbar__inner--user">
        ${devBtn}
        <a href="news.html" class="site-topbar__icon-btn" title="Новости">${ICONS.news}</a>
        <div class="site-topbar__notif-wrap">
          <button type="button" class="site-topbar__icon-btn" data-notif-toggle title="Уведомления">
            ${ICONS.bell}
            <span class="site-topbar__badge hidden" id="notifBadge">0</span>
          </button>
          <div id="notifDropdown" class="notif-dropdown hidden">
            <div class="notif-dropdown__head">
              <span>Уведомления</span>
              <button type="button" class="notif-dropdown__read" id="notifReadAll">Прочитать все</button>
            </div>
            <div id="notifPanel" class="notif-panel"></div>
          </div>
        </div>
        <a href="friends.html" class="site-topbar__icon-btn" title="Друзья">${ICONS.friends}</a>
        ${chip}
      </div>`;

    mount.querySelector("[data-dev-panel]")?.addEventListener("click", () => {
      window.BunkerDevPanel?.open();
    });

    if (window.BunkerNotifications) {
      BunkerNotifications.mount(
        document.getElementById("notifBadge"),
        document.getElementById("notifPanel")
      );
      document.querySelector("[data-notif-toggle]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        BunkerNotifications.togglePanel();
      });
      document.getElementById("notifReadAll")?.addEventListener("click", () => {
        BunkerNotifications.markAllRead();
        BunkerNotifications.togglePanel(false);
      });
    }

    if (window.BunkerChatWidget) BunkerChatWidget.showForLoggedIn();
  }

  function bindSocial() {
    if (!window.BunkerSocial) return;
    BunkerSocial.connect();
    if (window.BunkerNotifications) {
      BunkerNotifications.bindSocial?.();
      BunkerNotifications.syncIncomingFromApi();
    }
  }

  async function init() {
    if (!window.BunkerAuth || !BunkerAuth.apiBase()) {
      renderGuest();
      return;
    }
    const user = await BunkerAuth.fetchMe();
    if (user) {
      renderUser(user);
      bindSocial(user);
    } else {
      renderGuest();
    }
  }

  window.BunkerSiteAuth = { refresh: init };
  init();
})();
