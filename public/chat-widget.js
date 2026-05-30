(function () {
  const CHAT_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const UNREAD_KEY = "bunker:chatUnread";
  const { parseSticker, formatStickerBody, renderEmojiButtonsHtml, renderStickerButtonsHtml } =
    BunkerChatAttachments;

  let root = null;
  let friends = [];
  let activePeerId = null;
  let activePeerName = "";
  let panelOpen = false;

  function loadUnread() {
    try {
      return JSON.parse(localStorage.getItem(UNREAD_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveUnread(map) {
    localStorage.setItem(UNREAD_KEY, JSON.stringify(map));
  }

  function getUnread(peerId) {
    return loadUnread()[peerId] || 0;
  }

  function setUnread(peerId, count) {
    const map = loadUnread();
    if (count > 0) map[peerId] = count;
    else delete map[peerId];
    saveUnread(map);
    updateBadges();
  }

  function totalUnread() {
    return Object.values(loadUnread()).reduce((a, b) => a + b, 0);
  }

  function incrementUnread(peerId) {
    setUnread(peerId, getUnread(peerId) + 1);
  }

  function clearUnread(peerId) {
    setUnread(peerId, 0);
  }

  function updateBadges() {
    if (!root) return;
    const fabBadge = root.querySelector("[data-chat-fab-badge]");
    const total = totalUnread();
    if (fabBadge) {
      fabBadge.textContent = total > 99 ? "99+" : String(total);
      fabBadge.classList.toggle("hidden", total === 0);
    }
    root.querySelectorAll("[data-chat-peer]").forEach((btn) => {
      const id = btn.dataset.chatPeer;
      const n = getUnread(id);
      let badge = btn.querySelector(".chat-widget__unread");
      if (n > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "chat-widget__unread";
          btn.appendChild(badge);
        }
        badge.textContent = n > 99 ? "99+" : String(n);
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function ensureWidget() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "chat-widget hidden";
    root.innerHTML = `
      <button type="button" class="chat-widget__fab" data-chat-fab title="Чат" aria-label="Чат">
        ${CHAT_ICON}
        <span class="chat-widget__fab-badge hidden" data-chat-fab-badge>0</span>
      </button>
      <div class="chat-widget__panel hidden" data-chat-panel>
        <div class="chat-widget__head">
          <span data-chat-head-title>Чат</span>
          <button type="button" class="chat-widget__back hidden" data-chat-back aria-label="Назад">←</button>
          <button type="button" class="chat-widget__close" data-chat-close aria-label="Закрыть">×</button>
        </div>
        <div class="chat-widget__friends" data-chat-friends></div>
        <div class="chat-widget__thread hidden" data-chat-thread>
          <div class="chat-widget__messages" data-chat-messages></div>
          <form class="chat-widget__form" data-chat-form>
            <button type="button" class="chat-widget__tool" data-chat-toggle-emoji title="Эмодзи" aria-label="Эмодзи">😊</button>
            <button type="button" class="chat-widget__tool" data-chat-toggle-stickers title="Стикеры" aria-label="Стикеры">🖼️</button>
            <input type="text" data-chat-input maxlength="2000" placeholder="Сообщение…" autocomplete="off">
            <button type="submit" class="btn btn--amber btn--small">→</button>
          </form>
          <div class="chat-widget__picker chat-widget__picker--emoji hidden" data-chat-emoji-panel></div>
          <div class="chat-widget__picker chat-widget__picker--stickers hidden" data-chat-sticker-panel></div>
          <p class="form-error hidden" data-chat-error></p>
        </div>
        <p class="chat-widget__hint" data-chat-hint>Сообщения хранятся 48 часов</p>
      </div>`;
    document.body.appendChild(root);

    root.querySelector("[data-chat-fab]").addEventListener("click", togglePanel);
    root.querySelector("[data-chat-close]").addEventListener("click", () => togglePanel(false));
    root.querySelector("[data-chat-back]").addEventListener("click", showFriendsList);
    root.querySelector("[data-chat-form]").addEventListener("submit", onSubmit);
    root.querySelector("[data-chat-toggle-emoji]").addEventListener("click", toggleEmojiPanel);
    root.querySelector("[data-chat-toggle-stickers]").addEventListener("click", toggleStickerPanel);
    root.querySelector("[data-chat-friends]").addEventListener("click", (e) => {
      const id = e.target.closest("[data-chat-peer]")?.dataset.chatPeer;
      if (id) openThread(id);
    });
    root.querySelector("[data-chat-emoji-panel]").addEventListener("click", onEmojiClick);
    root.querySelector("[data-chat-sticker-panel]").addEventListener("click", onStickerClick);
    renderEmojiPanel();
    renderStickerPanel();

    if (window.BunkerSocial) {
      BunkerSocial.onChat((msg) => {
        const peerId = msg.mine ? msg.toUserId : msg.fromUserId;
        const inThread =
          activePeerId &&
          panelOpen &&
          (msg.fromUserId === activePeerId || msg.toUserId === activePeerId);
        if (inThread) {
          appendMessage(msg);
        } else if (!msg.mine && peerId) {
          incrementUnread(peerId);
        }
      });
    }

    updateBadges();
    return root;
  }

  function showForLoggedIn() {
    if (!window.BunkerAuth?.getToken() || !BunkerAuth.apiBase()) return;
    ensureWidget();
    root.classList.remove("hidden");
    BunkerSocial?.connect();
    loadFriends();
  }

  async function loadFriends() {
    try {
      const data = await BunkerAuth.getFriends();
      friends = data.friends || [];
      renderFriends();
    } catch {
      friends = [];
    }
  }

  function renderFriends() {
    const el = root.querySelector("[data-chat-friends]");
    if (!friends.length) {
      el.innerHTML = '<p class="chat-widget__empty">Нет друзей для переписки.</p>';
      return;
    }
    el.innerHTML = friends
      .map((f) => {
        const av = BunkerAuth.assetUrl(f.avatarUrl || "/icons/default-avatar.svg");
        const n = getUnread(f.id);
        const badge = n > 0 ? `<span class="chat-widget__unread">${n > 99 ? "99+" : n}</span>` : "";
        return `<button type="button" class="chat-widget__friend" data-chat-peer="${f.id}">
          <img src="${av}" alt="">
          <span>${BunkerUserBadges.escapeHtml(f.nickname)}</span>
          ${badge}
        </button>`;
      })
      .join("");
    updateBadges();
  }

  function showFriendsList() {
    activePeerId = null;
    root.querySelector("[data-chat-head-title]").textContent = "Чат";
    root.querySelector("[data-chat-back]").classList.add("hidden");
    root.querySelector("[data-chat-friends]").classList.remove("hidden");
    root.querySelector("[data-chat-thread]").classList.add("hidden");
    root.querySelector("[data-chat-hint]").classList.remove("hidden");
    hidePanels();
  }

  async function openThread(peerId) {
    activePeerId = peerId;
    clearUnread(peerId);
    const friend = friends.find((f) => f.id === peerId);
    activePeerName = friend?.nickname || "Чат";
    root.querySelector("[data-chat-head-title]").textContent = activePeerName;
    root.querySelector("[data-chat-back]").classList.remove("hidden");
    root.querySelector("[data-chat-friends]").classList.add("hidden");
    root.querySelector("[data-chat-thread]").classList.remove("hidden");
    root.querySelector("[data-chat-hint]").classList.add("hidden");
    const msgs = root.querySelector("[data-chat-messages]");
    msgs.innerHTML = "";
    showError("");
    try {
      const data = await BunkerAuth.getChat(peerId);
      data.messages.forEach(appendMessage);
    } catch (err) {
      showError(err.message);
    }
  }

  function appendMessage(msg) {
    const msgs = root.querySelector("[data-chat-messages]");
    const el = document.createElement("div");
    el.className = `chat-widget__msg ${msg.mine ? "chat-widget__msg--mine" : ""}`;
    const sticker = parseSticker(msg.body);
    if (sticker) {
      el.classList.add("chat-widget__msg--sticker");
      const img = document.createElement("img");
      img.className = "chat-widget__sticker";
      img.src = sticker.src;
      img.alt = sticker.title;
      img.loading = "lazy";
      img.decoding = "async";
      el.appendChild(img);
    } else {
      el.textContent = msg.body;
    }
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showError(msg) {
    const el = root.querySelector("[data-chat-error]");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  function onSubmit(e) {
    e.preventDefault();
    const input = root.querySelector("[data-chat-input]");
    const body = input.value.trim();
    if (!body || !activePeerId) return;
    BunkerSocial.sendChat(activePeerId, body);
    input.value = "";
    hidePanels();
  }

  function hidePanels() {
    root.querySelector("[data-chat-emoji-panel]").classList.add("hidden");
    root.querySelector("[data-chat-sticker-panel]").classList.add("hidden");
  }

  function toggleEmojiPanel() {
    if (!activePeerId) return;
    const emoji = root.querySelector("[data-chat-emoji-panel]");
    const stickers = root.querySelector("[data-chat-sticker-panel]");
    const show = emoji.classList.contains("hidden");
    emoji.classList.toggle("hidden", !show);
    stickers.classList.add("hidden");
  }

  function toggleStickerPanel() {
    if (!activePeerId) return;
    const stickers = root.querySelector("[data-chat-sticker-panel]");
    const emoji = root.querySelector("[data-chat-emoji-panel]");
    const show = stickers.classList.contains("hidden");
    stickers.classList.toggle("hidden", !show);
    emoji.classList.add("hidden");
  }

  function renderEmojiPanel() {
    const panel = root.querySelector("[data-chat-emoji-panel]");
    panel.innerHTML = renderEmojiButtonsHtml().replace(/chat-picker__/g, "chat-widget__");
  }

  function renderStickerPanel() {
    const panel = root.querySelector("[data-chat-sticker-panel]");
    panel.innerHTML = renderStickerButtonsHtml().replace(/chat-picker__/g, "chat-widget__");
  }

  function onEmojiClick(e) {
    const btn = e.target.closest("[data-chat-emoji]");
    if (!btn) return;
    const input = root.querySelector("[data-chat-input]");
    input.value += btn.dataset.chatEmoji || "";
    input.focus();
  }

  function onStickerClick(e) {
    const btn = e.target.closest("[data-chat-sticker-file]");
    if (!btn || !activePeerId) return;
    const packId = btn.dataset.chatStickerPack;
    const file = btn.dataset.chatStickerFile;
    if (!packId || !file) return;
    const body = formatStickerBody(packId, file);
    BunkerSocial.sendChat(activePeerId, body);
    hidePanels();
  }

  function togglePanel(show) {
    ensureWidget();
    const panel = root.querySelector("[data-chat-panel]");
    const open = show ?? panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !open);
    panelOpen = open;
    if (open) {
      showFriendsList();
      loadFriends();
    } else {
      activePeerId = null;
      hidePanels();
      root.classList.remove("chat-widget--messenger");
    }
  }

  function open(peerId, nickname) {
    ensureWidget();
    togglePanel(true);
    if (peerId) {
      if (nickname) activePeerName = nickname;
      openThread(peerId);
    }
  }

  function openMessenger() {
    ensureWidget();
    root.classList.add("chat-widget--messenger");
    togglePanel(true);
  }

  window.BunkerChatWidget = { showForLoggedIn, open, toggle: togglePanel, openMessenger };
})();
