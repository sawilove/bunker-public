(function () {
  const CHAT_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

  let root = null;
  let friends = [];
  let activePeerId = null;
  let activePeerName = "";

  function ensureWidget() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "chat-widget hidden";
    root.innerHTML = `
      <button type="button" class="chat-widget__fab" data-chat-fab title="Чат" aria-label="Чат">
        ${CHAT_ICON}
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
            <input type="text" data-chat-input maxlength="2000" placeholder="Сообщение…" autocomplete="off">
            <button type="submit" class="btn btn--amber btn--small">→</button>
          </form>
          <p class="form-error hidden" data-chat-error></p>
        </div>
        <p class="chat-widget__hint" data-chat-hint>Сообщения хранятся 48 часов</p>
      </div>`;
    document.body.appendChild(root);

    root.querySelector("[data-chat-fab]").addEventListener("click", togglePanel);
    root.querySelector("[data-chat-close]").addEventListener("click", () => togglePanel(false));
    root.querySelector("[data-chat-back]").addEventListener("click", showFriendsList);
    root.querySelector("[data-chat-form]").addEventListener("submit", onSubmit);
    root.querySelector("[data-chat-friends]").addEventListener("click", (e) => {
      const id = e.target.closest("[data-chat-peer]")?.dataset.chatPeer;
      if (id) openThread(id);
    });

    if (window.BunkerSocial) {
      BunkerSocial.onChat((msg) => {
        if (
          activePeerId &&
          (msg.fromUserId === activePeerId || msg.toUserId === activePeerId)
        ) {
          appendMessage(msg);
        }
      });
    }

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
        return `<button type="button" class="chat-widget__friend" data-chat-peer="${f.id}">
          <img src="${av}" alt="">
          <span>${BunkerUserBadges.escapeHtml(f.nickname)}</span>
        </button>`;
      })
      .join("");
  }

  function showFriendsList() {
    activePeerId = null;
    root.querySelector("[data-chat-head-title]").textContent = "Чат";
    root.querySelector("[data-chat-back]").classList.add("hidden");
    root.querySelector("[data-chat-friends]").classList.remove("hidden");
    root.querySelector("[data-chat-thread]").classList.add("hidden");
    root.querySelector("[data-chat-hint]").classList.remove("hidden");
  }

  async function openThread(peerId) {
    activePeerId = peerId;
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
    el.textContent = msg.body;
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
  }

  function togglePanel(show) {
    ensureWidget();
    const panel = root.querySelector("[data-chat-panel]");
    const open = show ?? panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !open);
    if (open) {
      showFriendsList();
      loadFriends();
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

  window.BunkerChatWidget = { showForLoggedIn, open, toggle: togglePanel };
})();
