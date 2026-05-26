const friendsList = document.getElementById("friendsList");
const incomingList = document.getElementById("incomingList");
const incomingSection = document.getElementById("incomingSection");
const chatTitle = document.getElementById("chatTitle");
const chatSubtitle = document.getElementById("chatSubtitle");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatError = document.getElementById("chatError");
const addFriendForm = document.getElementById("addFriendForm");
const addFriendError = document.getElementById("addFriendError");
const addFriendSuccess = document.getElementById("addFriendSuccess");
const inviteToast = document.getElementById("inviteToast");

let friendsData = { friends: [], incoming: [], outgoing: [] };
let activePeerId = null;

function showMsg(el, msg, isError = true) {
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("form-error", isError);
  el.classList.toggle("form-success", !isError);
}

function playerUrl(code) {
  const base = location.pathname.replace(/[^/]*$/, "");
  return `${location.origin}${base}player.html?code=${encodeURIComponent(code)}`;
}

function renderFriendRow(user, actionsHtml) {
  const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");
  const frame = BunkerUserBadges.frameClass(user);
  const badges = BunkerUserBadges.roleBadgesHtml(user);
  const status = BunkerUserBadges.statusHtml(user);
  const profileHref = BunkerAuth.profileUrl(user.id);
  return `
    <li class="friends-list__item ${frame}" data-user-id="${user.id}">
      <a href="${profileHref}" class="friends-list__avatar-link"><img class="friends-list__avatar" src="${av}" alt=""></a>
      <div class="friends-list__info">
        <a href="${profileHref}" class="friends-list__name friends-list__name--link">${BunkerUserBadges.escapeHtml(user.nickname)}</a>
        ${status}
        <span class="friends-list__badges">${badges}</span>
      </div>
      <div class="friends-list__actions">${actionsHtml}</div>
    </li>`;
}

function renderLists() {
  if (friendsData.friends.length === 0) {
    friendsList.innerHTML =
      '<li class="friends-list__empty">Пока нет друзей — добавьте по никнейму.</li>';
  } else {
    friendsList.innerHTML = friendsData.friends
      .map((u) =>
        renderFriendRow(
          u,
          `<button type="button" class="btn btn--small" data-chat="${u.id}">Чат</button>
           <button type="button" class="btn btn--small btn--danger" data-remove="${u.id}">Удалить</button>`
        )
      )
      .join("");
  }

  if (friendsData.incoming.length === 0) {
    incomingSection.classList.add("hidden");
  } else {
    incomingSection.classList.remove("hidden");
    incomingList.innerHTML = friendsData.incoming
      .map((u) =>
        renderFriendRow(
          u,
          `<button type="button" class="btn btn--small btn--amber" data-accept="${u.id}">Принять</button>
           <button type="button" class="btn btn--small" data-decline="${u.id}">Отклонить</button>`
        )
      )
      .join("");
  }
}

async function loadFriends() {
  friendsData = await BunkerAuth.getFriends();
  renderLists();
  if (activePeerId) {
    const still = friendsData.friends.find((f) => f.id === activePeerId);
    if (still) openChat(still);
    else {
      activePeerId = null;
      chatForm.classList.add("hidden");
      chatSubtitle.textContent = "Выберите друга слева";
    }
  }
}

function appendChatMessage(msg) {
  const el = document.createElement("div");
  el.className = `friends-chat__msg ${msg.mine ? "friends-chat__msg--mine" : ""}`;
  el.textContent = msg.body;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function openChat(user) {
  activePeerId = user.id;
  chatTitle.textContent = user.nickname;
  chatSubtitle.textContent = BunkerUserBadges.STATUS_LABELS[user.status] || "";
  chatForm.classList.remove("hidden");
  chatMessages.innerHTML = "";
  showMsg(chatError, "");
  try {
    const data = await BunkerAuth.getChat(user.id);
    data.messages.forEach(appendChatMessage);
  } catch (err) {
    showMsg(chatError, err.message);
  }
}

function showInviteToast(data) {
  const url = playerUrl(data.code);
  inviteToast.innerHTML = `
    <strong>${BunkerUserBadges.escapeHtml(data.fromNickname || "Игрок")}</strong> приглашает в сессию
    <code>${data.code}</code>
    <a class="btn btn--amber btn--small" href="${url}">Присоединиться</a>
    <button type="button" class="invite-toast__close" aria-label="Закрыть">×</button>`;
  inviteToast.classList.remove("hidden");
  inviteToast.querySelector(".invite-toast__close").onclick = () => {
    inviteToast.classList.add("hidden");
  };
}

document.body.addEventListener("click", async (e) => {
  const chatId = e.target.dataset.chat;
  const inviteId = e.target.dataset.invite;
  const removeId = e.target.dataset.remove;
  const acceptId = e.target.dataset.accept;
  const declineId = e.target.dataset.decline;

  if (chatId) {
    const user = friendsData.friends.find((f) => f.id === chatId);
    if (user) openChat(user);
  }
  if (removeId && confirm("Удалить из друзей?")) {
    await BunkerAuth.removeFriend(removeId);
    await loadFriends();
  }
  if (acceptId) {
    await BunkerAuth.respondFriend(acceptId, true);
    await loadFriends();
  }
  if (declineId) {
    await BunkerAuth.respondFriend(declineId, false);
    await loadFriends();
  }
});

addFriendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg(addFriendError, "");
  showMsg(addFriendSuccess, "", false);
  try {
    const nick = document.getElementById("addFriendNick").value;
    const result = await BunkerAuth.requestFriend(nick);
    document.getElementById("addFriendNick").value = "";
    showMsg(
      addFriendSuccess,
      result.accepted ? "Заявка принята — вы друзья!" : "Заявка отправлена.",
      false
    );
    await loadFriends();
  } catch (err) {
    showMsg(addFriendError, err.message);
  }
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const body = chatInput.value.trim();
  if (!body || !activePeerId) return;
  BunkerSocial.sendChat(activePeerId, body);
  chatInput.value = "";
});

BunkerSocial.onChat((msg) => {
  if (msg.fromUserId === activePeerId || msg.toUserId === activePeerId) {
    appendChatMessage(msg);
  }
});

BunkerSocial.onPresence(({ userId, status }) => {
  for (const list of [friendsData.friends, friendsData.incoming, friendsData.outgoing]) {
    const u = list.find((f) => f.id === userId);
    if (u) u.status = status;
  }
  renderLists();
  if (activePeerId) {
    const u = friendsData.friends.find((f) => f.id === activePeerId);
    if (u) chatSubtitle.textContent = BunkerUserBadges.STATUS_LABELS[u.status] || "";
  }
});

BunkerSocial.onInvite(showInviteToast);

(async function init() {
  if (!BunkerAuth.apiBase() || !BunkerAuth.getToken()) {
    location.href = "account.html";
    return;
  }
  BunkerSocial.connect();
  await loadFriends();
})();
