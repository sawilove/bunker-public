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

const friendsEmojiPanel = document.getElementById("friendsEmojiPanel");
const friendsStickerPanel = document.getElementById("friendsStickerPanel");
const { parseSticker, formatStickerBody, renderEmojiButtonsHtml, renderStickerButtonsHtml } =
  BunkerChatAttachments;

if (friendsEmojiPanel) {
  friendsEmojiPanel.innerHTML = renderEmojiButtonsHtml().replace(/chat-picker__/g, "friends-chat__");
}
if (friendsStickerPanel) {
  friendsStickerPanel.innerHTML = renderStickerButtonsHtml().replace(/chat-picker__/g, "friends-chat__");
}

function hideFriendsPickers() {
  friendsEmojiPanel?.classList.add("hidden");
  friendsStickerPanel?.classList.add("hidden");
}

function toggleFriendsEmojiPanel() {
  if (!activePeerId) return;
  const show = friendsEmojiPanel.classList.contains("hidden");
  friendsEmojiPanel.classList.toggle("hidden", !show);
  friendsStickerPanel.classList.add("hidden");
}

function toggleFriendsStickerPanel() {
  if (!activePeerId) return;
  const show = friendsStickerPanel.classList.contains("hidden");
  friendsStickerPanel.classList.toggle("hidden", !show);
  friendsEmojiPanel.classList.add("hidden");
}

function showMsg(el, msg, isError = true) {
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("form-error", isError);
  el.classList.toggle("form-success", !isError);
}

function playerUrl(code) {
  const base = location.pathname.replace(/[^/]*$/, "");
  return `${location.origin}${base}game/${encodeURIComponent(code)}`;
}

function renderFriendRow(user, actionsHtml) {
  const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");
  const frame = BunkerUserBadges.frameClass(user);
  const badges = BunkerUserBadges.roleBadgesHtml(user);
  const statusUser = { ...user };
  if (user.lookingForGame && user.status !== "offline") {
    statusUser.status = "looking_for_game";
  }
  const status = BunkerUserBadges.statusHtml(statusUser);
  const profileHref = BunkerAuth.profileUrl(user);
  const inviteBtn =
    user.lookingForGame && user.status !== "offline"
      ? `<button type="button" class="btn btn--small btn--amber" data-invite="${user.id}">Пригласить</button>`
      : "";
  return `
    <li class="friends-list__item ${frame}" data-user-id="${user.id}">
      <a href="${profileHref}" class="friends-list__avatar-link"><img class="friends-list__avatar" src="${av}" alt=""></a>
      <div class="friends-list__info">
        <a href="${profileHref}" class="friends-list__name friends-list__name--link">${BunkerUserBadges.escapeHtml(user.nickname)}</a>
        ${status}
        <span class="friends-list__badges">${badges}</span>
      </div>
      <div class="friends-list__actions">${inviteBtn}${actionsHtml}</div>
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
  const sticker = parseSticker(msg.body);
  if (sticker) {
    el.classList.add("friends-chat__msg--sticker");
    const img = document.createElement("img");
    img.className = "friends-chat__sticker";
    img.src = sticker.src;
    img.alt = sticker.title;
    img.loading = "lazy";
    img.decoding = "async";
    el.appendChild(img);
  } else {
    el.textContent = msg.body;
  }
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function openChat(user) {
  activePeerId = user.id;
  chatTitle.textContent = user.nickname;
  chatSubtitle.textContent = BunkerUserBadges.STATUS_LABELS[user.status] || "";
  chatForm.classList.remove("hidden");
  hideFriendsPickers();
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
  if (inviteId) {
    BunkerSocial.inviteToSession(inviteId);
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

const addFriendNick = document.getElementById("addFriendNick");
const addFriendSuggest = document.getElementById("addFriendSuggest");
let suggestTimer = null;
let suggestSeq = 0;
let selectedUserId = null;
let lastSuggestions = [];

function hideSuggest() {
  addFriendSuggest.classList.add("hidden");
  addFriendSuggest.innerHTML = "";
}

async function updateSuggest() {
  const q = addFriendNick.value.trim();
  showMsg(addFriendError, "");
  if (q.length < 1) {
    hideSuggest();
    lastSuggestions = [];
    return;
  }
  if (!BunkerAuth.apiBase()) {
    showMsg(addFriendError, "API не настроен.");
    return;
  }
  const seq = ++suggestSeq;
  try {
    const users = await BunkerAuth.searchUsers(q);
    if (seq !== suggestSeq) return;
    lastSuggestions = users;
    if (!users.length) {
      addFriendSuggest.innerHTML =
        '<li class="friends-suggest__empty">Никого не найдено</li>';
      addFriendSuggest.classList.remove("hidden");
      return;
    }
    addFriendSuggest.innerHTML = users
      .map(
        (u) =>
          `<li class="friends-suggest__item" role="option" data-suggest-id="${u.id}">
            <img class="friends-suggest__avatar" src="${BunkerAuth.assetUrl(u.avatarUrl || "/icons/default-avatar.svg")}" alt="">
            <span class="friends-suggest__name">${BunkerUserBadges.escapeHtml(u.nickname)}</span>
          </li>`
      )
      .join("");
    addFriendSuggest.classList.remove("hidden");
  } catch (err) {
    hideSuggest();
    lastSuggestions = [];
    showMsg(addFriendError, err.message || "Ошибка поиска.");
  }
}

async function addFriendById(userId) {
  const result = await BunkerAuth.requestFriendById(userId);
  addFriendNick.value = "";
  selectedUserId = null;
  hideSuggest();
  showMsg(
    addFriendSuccess,
    result.accepted ? "Заявка принята — вы друзья!" : "Заявка отправлена.",
    false
  );
  await loadFriends();
}

addFriendNick.addEventListener("input", () => {
  selectedUserId = null;
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(updateSuggest, 120);
});

addFriendNick.addEventListener("focus", () => {
  if (addFriendNick.value.trim().length >= 1) updateSuggest();
});

addFriendNick.addEventListener("blur", () => {
  setTimeout(hideSuggest, 150);
});

addFriendSuggest.addEventListener("mousedown", async (e) => {
  e.preventDefault();
  const item = e.target.closest("[data-suggest-id]");
  if (!item) return;
  selectedUserId = item.dataset.suggestId;
  const nick = item.querySelector(".friends-suggest__name")?.textContent;
  if (nick) addFriendNick.value = nick;
  hideSuggest();
  showMsg(addFriendError, "");
  showMsg(addFriendSuccess, "", false);
  try {
    await addFriendById(selectedUserId);
  } catch (err) {
    showMsg(addFriendError, err.message);
  }
});

addFriendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg(addFriendError, "");
  showMsg(addFriendSuccess, "", false);
  try {
    const q = addFriendNick.value.trim();
    if (!q) {
      showMsg(addFriendError, "Введите никнейм для поиска.");
      return;
    }

    let userId = selectedUserId;
    if (!userId) {
      const exact = lastSuggestions.find(
        (u) => u.nickname.toLowerCase() === q.toLowerCase()
      );
      if (exact) userId = exact.id;
      else if (lastSuggestions.length === 1) userId = lastSuggestions[0].id;
      else {
        const users = await BunkerAuth.searchUsers(q);
        const match = users.find((u) => u.nickname.toLowerCase() === q.toLowerCase());
        if (match) userId = match.id;
        else if (users.length === 1) userId = users[0].id;
      }
    }

    if (!userId) {
      showMsg(addFriendError, "Выберите игрока из списка подсказок.");
      await updateSuggest();
      return;
    }

    await addFriendById(userId);
  } catch (err) {
    showMsg(addFriendError, err.message);
  }
});

document.querySelector("[data-friends-toggle-emoji]")?.addEventListener("click", toggleFriendsEmojiPanel);
document.querySelector("[data-friends-toggle-stickers]")?.addEventListener("click", toggleFriendsStickerPanel);

friendsEmojiPanel?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chat-emoji]");
  if (!btn) return;
  chatInput.value += btn.dataset.chatEmoji || "";
  chatInput.focus();
});

friendsStickerPanel?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chat-sticker-file]");
  if (!btn || !activePeerId) return;
  const packId = btn.dataset.chatStickerPack;
  const file = btn.dataset.chatStickerFile;
  if (!packId || !file) return;
  BunkerSocial.sendChat(activePeerId, formatStickerBody(packId, file));
  hideFriendsPickers();
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const body = chatInput.value.trim();
  if (!body || !activePeerId) return;
  BunkerSocial.sendChat(activePeerId, body);
  chatInput.value = "";
  hideFriendsPickers();
});

BunkerSocial.onChat((msg) => {
  if (msg.fromUserId === activePeerId || msg.toUserId === activePeerId) {
    appendChatMessage(msg);
  }
});

BunkerSocial.onPresence(({ userId, status, lookingForGame }) => {
  for (const list of [friendsData.friends, friendsData.incoming, friendsData.outgoing]) {
    const u = list.find((f) => f.id === userId);
    if (u) {
      u.status = status;
      u.lookingForGame = !!lookingForGame;
    }
  }
  renderLists();
  if (activePeerId) {
    const u = friendsData.friends.find((f) => f.id === activePeerId);
    if (u) {
      const su = { ...u };
      if (u.lookingForGame && u.status !== "offline") su.status = "looking_for_game";
      chatSubtitle.textContent = BunkerUserBadges.STATUS_LABELS[su.status] || "";
    }
  }
});

BunkerSocial.onInvite(showInviteToast);

const lfgToggle = document.getElementById("lfgToggle");
const groupsList = document.getElementById("groupsList");
const createGroupForm = document.getElementById("createGroupForm");
const groupNameInput = document.getElementById("groupNameInput");
const groupError = document.getElementById("groupError");

lfgToggle?.addEventListener("change", async (e) => {
  try {
    await BunkerAuth.setLookingForGame(e.target.checked);
  } catch (err) {
    e.target.checked = !e.target.checked;
    alert(err.message);
  }
});

function showGroupMsg(msg) {
  if (!groupError) return;
  groupError.textContent = msg || "";
  groupError.classList.toggle("hidden", !msg);
}

async function loadGroups() {
  if (!groupsList) return;
  try {
    const data = await BunkerAuth.getGroups();
    if (!data.groups?.length) {
      groupsList.innerHTML = '<li class="friends-groups__empty">Нет отрядов — создайте свой.</li>';
      return;
    }
    groupsList.innerHTML = data.groups
      .map(
        (g) => `<li class="friends-groups__item" data-group-id="${g.id}">
          <span class="friends-groups__name">${BunkerUserBadges.escapeHtml(g.name)}</span>
          <span class="friends-groups__meta">${g.memberCount} уч.</span>
          <button type="button" class="btn btn--small btn--amber" data-group-invite="${g.id}">В игру</button>
          <button type="button" class="btn btn--small" data-group-members="${g.id}">Участники</button>
        </li>`
      )
      .join("");
  } catch (err) {
    groupsList.innerHTML = `<li class="friends-groups__empty">${BunkerUserBadges.escapeHtml(err.message)}</li>`;
  }
}

createGroupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showGroupMsg("");
  try {
    await BunkerAuth.createGroup(groupNameInput.value);
    groupNameInput.value = "";
    await loadGroups();
  } catch (err) {
    showGroupMsg(err.message);
  }
});

groupsList?.addEventListener("click", async (e) => {
  const inviteId = e.target.closest("[data-group-invite]")?.dataset.groupInvite;
  if (inviteId) {
    BunkerSocial.inviteGroupToSession(inviteId);
    return;
  }
  const membersId = e.target.closest("[data-group-members]")?.dataset.groupMembers;
  if (membersId) {
    try {
      const data = await BunkerAuth.getGroupMembers(membersId);
      const names = data.members.map((m) => m.nickname).join(", ");
      alert(`Участники «${data.group.name}»:\n${names}`);
    } catch (err) {
      alert(err.message);
    }
  }
});

(async function init() {
  if (!BunkerAuth.apiBase() || !BunkerAuth.getToken()) {
    location.href = "auth.html?tab=login";
    return;
  }
  BunkerSocial.connect();
  await loadFriends();
  await loadGroups();
  try {
    const me = await BunkerAuth.fetchMe();
    if (lfgToggle) lfgToggle.checked = !!me?.lookingForGame;
  } catch {
    /* ignore */
  }
})();
