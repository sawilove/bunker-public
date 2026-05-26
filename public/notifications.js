(function () {

  const STORAGE = "bunker:notifications";

  const MAX = 80;

  const POLL_MS = 30000;

  let items = [];

  let panelEl = null;

  let badgeEl = null;

  let listeners = [];

  let pollTimer = null;

  let socialBound = false;



  function load() {

    try {

      items = JSON.parse(localStorage.getItem(STORAGE) || "[]");

    } catch {

      items = [];

    }

  }



  function save() {

    localStorage.setItem(STORAGE, JSON.stringify(items.slice(0, MAX)));

    updateBadge();

    listeners.forEach((fn) => fn());

  }



  function updateBadge() {

    if (!badgeEl) return;

    const n = items.filter((i) => !i.read).length;

    badgeEl.textContent = n > 99 ? "99+" : String(n);

    badgeEl.classList.toggle("hidden", n === 0);

  }



  function add(item) {

    const key = item.dedupeKey || `${item.type}:${item.id || item.at}`;

    if (items.some((i) => (i.dedupeKey || `${i.type}:${i.id}`) === key)) return;

    items.unshift({

      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

      type: item.type,

      title: item.title,

      body: item.body || "",

      href: item.href || "",

      action: item.action || null,

      at: item.at || Date.now(),

      read: false,

      dedupeKey: key,

    });

    save();

    if (panelEl && !document.getElementById("notifDropdown")?.classList.contains("hidden")) {

      renderPanel();

    }

  }



  function markRead(id) {

    const it = items.find((i) => i.id === id);

    if (it) it.read = true;

    save();

  }



  function markAllRead() {

    items.forEach((i) => {

      i.read = true;

    });

    save();

    renderPanel();

  }



  function clearAll() {

    items = [];

    save();

    renderPanel();

  }



  function unreadCount() {

    return items.filter((i) => !i.read).length;

  }



  function escapeHtml(s) {

    const el = document.createElement("div");

    el.textContent = s || "";

    return el.innerHTML;

  }



  function formatTime(at) {

    const d = new Date(at);

    return d.toLocaleString("ru-RU", {

      day: "numeric",

      month: "short",

      hour: "2-digit",

      minute: "2-digit",

    });

  }



  function renderPanel() {

    if (!panelEl) return;

    if (items.length === 0) {

      panelEl.innerHTML = '<p class="notif-panel__empty">Пока пусто</p>';

      return;

    }

    panelEl.innerHTML = items

      .map((n) => {

        const actions =

          n.type === "friend_request" && n.action

            ? `<div class="notif-panel__actions">

                <button type="button" class="btn btn--small btn--amber" data-notif-accept="${escapeHtml(n.action.userId)}">Принять</button>

                <button type="button" class="btn btn--small" data-notif-decline="${escapeHtml(n.action.userId)}">Отклонить</button>

               </div>`

            : n.href

              ? `<a href="${n.href}" class="btn btn--small btn--amber">Открыть</a>`

              : "";

        return `

        <article class="notif-panel__item ${n.read ? "" : "notif-panel__item--unread"}" data-notif-id="${n.id}">

          <p class="notif-panel__title">${escapeHtml(n.title)}</p>

          ${n.body ? `<p class="notif-panel__body">${escapeHtml(n.body)}</p>` : ""}

          <time class="notif-panel__time">${formatTime(n.at)}</time>

          ${actions}

        </article>`;

      })

      .join("");

  }



  function togglePanel(show) {

    const wrap = document.getElementById("notifDropdown");

    if (!wrap) return;

    const open = show ?? wrap.classList.contains("hidden");

    wrap.classList.toggle("hidden", !open);

    if (open) {

      renderPanel();

      document.addEventListener("click", onDocClick);

    } else {

      document.removeEventListener("click", onDocClick);

    }

  }



  function onDocClick(e) {

    const wrap = document.getElementById("notifDropdown");

    if (wrap && !wrap.contains(e.target) && !e.target.closest("[data-notif-toggle]")) {

      togglePanel(false);

    }

  }



  function bindPanelEvents() {

    if (!panelEl) return;

    panelEl.addEventListener("click", async (e) => {

      const itemEl = e.target.closest("[data-notif-id]");

      if (itemEl) markRead(itemEl.dataset.notifId);



      const acceptId = e.target.closest("[data-notif-accept]")?.dataset.notifAccept;

      const declineId = e.target.closest("[data-notif-decline]")?.dataset.notifDecline;

      if (acceptId && window.BunkerAuth) {

        await BunkerAuth.respondFriend(acceptId, true);

        items = items.filter(

          (i) => !(i.type === "friend_request" && i.action?.userId === acceptId)

        );

        save();

        renderPanel();

      }

      if (declineId && window.BunkerAuth) {

        await BunkerAuth.respondFriend(declineId, false);

        items = items.filter(

          (i) => !(i.type === "friend_request" && i.action?.userId === declineId)

        );

        save();

        renderPanel();

      }

    });

  }



  function addFriendRequest(from) {

    add({

      type: "friend_request",

      title: `${from.nickname || "Игрок"} хочет добавить вас в друзья`,

      body: "Примите или отклоните заявку",

      dedupeKey: `friend_request:${from.userId || from.id}`,

      action: { userId: from.userId || from.id },

    });

  }



  function addSessionInvite(data) {

    const base = location.pathname.replace(/[^/]*$/, "");

    const url = `${base}game/${encodeURIComponent(data.code)}`;

    add({

      type: "session_invite",

      title: `${data.fromNickname || "Игрок"} зовёт в игру`,

      body: `Код сессии: ${data.code}`,

      href: url,

      dedupeKey: `session_invite:${data.code}:${data.fromUserId}`,

    });

  }



  async function syncIncomingFromApi() {

    if (!window.BunkerAuth?.getToken()) return;

    try {

      const data = await BunkerAuth.getFriends();

      (data.incoming || []).forEach((u) => {

        addFriendRequest({ userId: u.id, nickname: u.nickname });

      });

    } catch {

      /* ignore */

    }

  }



  function startPolling() {

    if (pollTimer) return;

    pollTimer = setInterval(() => {

      if (!BunkerAuth?.getToken()) return;

      syncIncomingFromApi();

      if (window.BunkerSocial && !BunkerSocial.isConnected()) {

        BunkerSocial.connect();

      }

    }, POLL_MS);

  }



  function bindSocial() {

    if (!window.BunkerSocial || socialBound) return;

    socialBound = true;

    BunkerSocial.onInvite(addSessionInvite);

    BunkerSocial.onFriendRequest((data) => {

      addFriendRequest({

        userId: data.fromUserId,

        nickname: data.fromNickname,

      });

    });

    BunkerSocial.onConnected(() => syncIncomingFromApi());

    BunkerSocial.connect();

    startPolling();

  }



  function mount(badgeElement, panelElement) {

    badgeEl = badgeElement;

    panelEl = panelElement;

    load();

    updateBadge();

    bindPanelEvents();

    bindSocial();

  }



  window.BunkerNotifications = {

    mount,

    bindSocial,

    add,

    addFriendRequest,

    addSessionInvite,

    syncIncomingFromApi,

    markAllRead,

    clearAll,

    unreadCount,

    togglePanel,

    onChange: (fn) => listeners.push(fn),

  };



  load();

})();

