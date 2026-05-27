(function () {
  const mount = document.querySelector("[data-site-topbar]");
  if (!mount) return;

  const ICONS = {
    friends: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    bell: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    chat: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    news: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    premium: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18l-2.2-10-4.3 4-3.5-6-3.5 6-4.3-4L3 18z"/></svg>`,
    menu: `<svg class="site-topbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>`,
  };

  function detectMobileAppShell() {
    const ua = navigator.userAgent || "";
    const byUa = /(Android|iPhone|iPad|iPod|Mobile|wv)/i.test(ua);
    const byCapacitor = !!window.Capacitor?.isNativePlatform?.();
    return byUa || byCapacitor;
  }

  if (detectMobileAppShell()) {
    document.documentElement.classList.add("mobile-app-shell");
    document.body?.classList.add("mobile-app-shell");
  }

  function bindCompactMenu() {
    const toggle = mount.querySelector("[data-topbar-menu-toggle]");
    const menu = mount.querySelector("[data-topbar-menu]");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", String(!menu.classList.contains("hidden")));
    });

    document.addEventListener("click", (e) => {
      if (!menu.classList.contains("hidden") && !menu.contains(e.target) && e.target !== toggle) {
        menu.classList.add("hidden");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    menu.querySelectorAll("a,button").forEach((el) => {
      el.addEventListener("click", () => {
        menu.classList.add("hidden");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function closeAllMenus() {
    mount.querySelectorAll("[data-topbar-menu]").forEach((menu) => {
      menu.classList.add("hidden");
    });
    mount.querySelectorAll("[data-topbar-menu-toggle]").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function openMobileSettings() {
    let modal = document.getElementById("mobileSettingsModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "mobileSettingsModal";
      modal.className = "mobile-settings-modal hidden";
      modal.innerHTML = `
        <div class="mobile-settings-modal__card panel">
          <div class="mobile-settings-modal__head">
            <h3>Настройки приложения</h3>
            <button type="button" class="mobile-settings-modal__close" data-mobile-settings-close aria-label="Закрыть">×</button>
          </div>
          <label class="mobile-settings-modal__row">
            <input type="checkbox" id="mobileReduceMotion">
            <span>Снизить анимации</span>
          </label>
          <label class="mobile-settings-modal__row">
            <input type="checkbox" id="mobileCompactUI">
            <span>Компактный интерфейс</span>
          </label>
          <p class="mobile-settings-modal__hint">Настройки сохраняются на этом устройстве.</p>
        </div>`;
      document.body.appendChild(modal);

      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.add("hidden");
      });
      modal.querySelector("[data-mobile-settings-close]")?.addEventListener("click", () => {
        modal.classList.add("hidden");
      });
      modal.querySelector("#mobileReduceMotion")?.addEventListener("change", (e) => {
        localStorage.setItem("bunker:mobile:reduceMotion", e.target.checked ? "1" : "0");
        document.body.classList.toggle("prefers-reduced-motion", e.target.checked);
      });
      modal.querySelector("#mobileCompactUI")?.addEventListener("change", (e) => {
        localStorage.setItem("bunker:mobile:compactUI", e.target.checked ? "1" : "0");
        document.body.classList.toggle("mobile-compact-ui", e.target.checked);
      });
    }

    const reduce = localStorage.getItem("bunker:mobile:reduceMotion") === "1";
    const compact = localStorage.getItem("bunker:mobile:compactUI") === "1";
    modal.querySelector("#mobileReduceMotion").checked = reduce;
    modal.querySelector("#mobileCompactUI").checked = compact;
    document.body.classList.toggle("prefers-reduced-motion", reduce);
    document.body.classList.toggle("mobile-compact-ui", compact);
    modal.classList.remove("hidden");
  }

  function renderMobileDock(user) {
    const old = document.querySelector("[data-mobile-dock]");
    old?.remove();
    if (!user || document.body.classList.contains("host")) return;

    const dock = document.createElement("nav");
    dock.className = "mobile-dock";
    dock.setAttribute("data-mobile-dock", "1");
    dock.setAttribute("aria-label", "Быстрое меню");
    const friendsUrl = BunkerAuth.pageUrl("friends.html");
    const playUrl = BunkerAuth.pageUrl("player.html");
    dock.innerHTML = `
      <a href="${friendsUrl}" class="mobile-dock__btn" title="Друзья" aria-label="Друзья">${ICONS.friends}</a>
      <button type="button" class="mobile-dock__btn" data-mobile-premium title="Премиум" aria-label="Премиум">${ICONS.premium}</button>
      <a href="${playUrl}" class="mobile-dock__btn mobile-dock__btn--play" title="Играть" aria-label="Играть">▶</a>
      <button type="button" class="mobile-dock__btn" data-mobile-chat title="Чат" aria-label="Чат">${ICONS.chat}</button>
    `;
    document.body.appendChild(dock);
    dock.querySelector("[data-mobile-premium]")?.addEventListener("click", () => {
      window.BunkerPremiumModal?.open(user);
    });
    dock.querySelector("[data-mobile-chat]")?.addEventListener("click", () => {
      window.BunkerChatWidget?.openMessenger?.();
    });
  }

  function renderGuest() {
    const loginUrl = window.BunkerAuth ? BunkerAuth.pageUrl("auth.html?tab=login") : "/auth?tab=login";
    const registerUrl = window.BunkerAuth ? BunkerAuth.pageUrl("auth.html?tab=register") : "/auth?tab=register";
    mount.innerHTML = `
      <div class="site-topbar__inner">
        <div class="site-topbar__desktop">
          <button type="button" class="site-topbar__premium-btn" data-premium-modal title="Премиум">${ICONS.premium}</button>
          <a href="${loginUrl}" class="site-topbar__link">Вход</a>
          <a href="${registerUrl}" class="site-topbar__btn btn btn--amber btn--small">Регистрация</a>
        </div>
        <button type="button" class="site-topbar__menu-btn" data-topbar-menu-toggle aria-expanded="false" aria-label="Меню">${ICONS.menu}</button>
        <div class="site-topbar__menu hidden" data-topbar-menu>
          <button type="button" class="site-topbar__menu-item" data-premium-modal>${ICONS.premium}<span>Премиум</span></button>
          <a href="${loginUrl}" class="site-topbar__menu-item"><span>Вход</span></a>
          <a href="${registerUrl}" class="site-topbar__menu-item"><span>Регистрация</span></a>
        </div>
      </div>`;

    mount.querySelectorAll("[data-premium-modal]").forEach((el) =>
      el.addEventListener("click", () => window.BunkerPremiumModal?.open(null))
    );
    bindCompactMenu();
    renderMobileDock(null);
  }

  function renderUser(user) {
    const profileHref = BunkerAuth.profileUrl(user);
    const newsUrl = BunkerAuth.pageUrl("news.html");
    const friendsUrl = BunkerAuth.pageUrl("friends.html");
    const menuUserChip = `
      <a href="${profileHref}" class="site-topbar__menu-profile">
        <img class="site-topbar__menu-profile-avatar" src="${BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg")}" alt="">
        <span class="site-topbar__menu-profile-name">${BunkerUserBadges.escapeHtml(user.nickname || "Игрок")}</span>
      </a>`;
    const chip = BunkerUserBadges.renderUserChip(user, {
      href: profileHref,
      showBadges: true,
    });
    const devBtn = user.dev
      ? `<button type="button" class="site-topbar__dev-btn" data-dev-panel title="Служебные настройки">&lt;/&gt;</button>`
      : "";
    const premiumBtn = `<button type="button" class="site-topbar__premium-btn" data-premium-modal title="Премиум">${ICONS.premium}</button>`;

    mount.innerHTML = `
      <div class="site-topbar__inner site-topbar__inner--user">
        <div class="site-topbar__desktop">
          ${devBtn}
          ${premiumBtn}
          <a href="${newsUrl}" class="site-topbar__icon-btn" title="Новости">${ICONS.news}</a>
          <div class="site-topbar__notif-wrap">
            <button type="button" class="site-topbar__icon-btn" data-notif-toggle title="Уведомления">
              ${ICONS.bell}
              <span class="site-topbar__badge hidden" id="notifBadge">0</span>
            </button>
            <div id="notifDropdown" class="notif-dropdown hidden">
              <div class="notif-dropdown__head">
                <span>Уведомления</span>
                <div class="notif-dropdown__actions">
                  <button type="button" class="notif-dropdown__read" id="notifClearAll">Очистить</button>
                  <button type="button" class="notif-dropdown__read" id="notifReadAll">Прочитать все</button>
                </div>
              </div>
              <div id="notifPanel" class="notif-panel"></div>
            </div>
          </div>
          <a href="${friendsUrl}" class="site-topbar__icon-btn" title="Друзья">${ICONS.friends}</a>
          ${chip}
        </div>
        <button type="button" class="site-topbar__menu-btn" data-topbar-menu-toggle aria-expanded="false" aria-label="Меню">${ICONS.menu}</button>
        <div class="site-topbar__menu hidden" data-topbar-menu>
          <div class="site-topbar__menu-user">${menuUserChip}</div>
          ${user.dev ? `<button type="button" class="site-topbar__menu-item" data-dev-panel>${ICONS.news}<span>Панель разработчика</span></button>` : ""}
          <button type="button" class="site-topbar__menu-item" data-mobile-settings>${ICONS.menu}<span>Настройки приложения</span></button>
          <button type="button" class="site-topbar__menu-item" data-premium-modal>${ICONS.premium}<span>Премиум</span></button>
          <a href="${friendsUrl}" class="site-topbar__menu-item">${ICONS.friends}<span>Друзья</span></a>
          <a href="${newsUrl}" class="site-topbar__menu-item">${ICONS.news}<span>Новости</span></a>
        </div>
      </div>`;

    mount.querySelector("[data-dev-panel]")?.addEventListener("click", () => {
      window.BunkerDevPanel?.open();
    });
    mount.querySelectorAll("[data-premium-modal]").forEach((el) =>
      el.addEventListener("click", () => window.BunkerPremiumModal?.open(user))
    );
    mount.querySelector("[data-mobile-settings]")?.addEventListener("click", () => {
      closeAllMenus();
      openMobileSettings();
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
      document.getElementById("notifClearAll")?.addEventListener("click", () => {
        BunkerNotifications.clearAll();
        BunkerNotifications.togglePanel(false);
      });
    }

    if (window.BunkerChatWidget) BunkerChatWidget.showForLoggedIn();
    renderMobileDock(user);
    bindCompactMenu();
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

