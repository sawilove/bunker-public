const authSection = document.getElementById("authSection");
const profileSection = document.getElementById("profileSection");
const profileView = document.getElementById("profileView");
const profileEditForm = document.getElementById("profileEditForm");
const accountTagline = document.getElementById("accountTagline");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const profileError = document.getElementById("profileError");
const profileSuccess = document.getElementById("profileSuccess");
const profileAvatar = document.getElementById("profileAvatar");
const profileAvatarWrap = document.getElementById("profileAvatarWrap");
const profileNickname = document.getElementById("profileNickname");
const profileBadges = document.getElementById("profileBadges");
const profileStatus = document.getElementById("profileStatus");
const profileBioView = document.getElementById("profileBioView");
const statGames = document.getElementById("statGames");
const statSurvivals = document.getElementById("statSurvivals");
const profileBio = document.getElementById("profileBio");
const editNickname = document.getElementById("editNickname");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
const editProfileBtn = document.getElementById("editProfileBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;

function showError(el, msg) {
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function setAvatarSrc(user, bust) {
  profileAvatar.src = BunkerAuth.avatarUrlForUser(user, bust || Date.now());
  if (profileAvatarWrap) {
    profileAvatarWrap.className = `profile-avatar-wrap ${BunkerUserBadges.frameClass(user)}`;
  }
}

function fillProfileView(user) {
  profileNickname.textContent = user.nickname;
  if (profileBadges) profileBadges.innerHTML = BunkerUserBadges.roleBadgesHtml(user);
  if (profileStatus) profileStatus.innerHTML = BunkerUserBadges.statusHtml(user);
  statGames.textContent = String(user.gamesPlayed ?? 0);
  statSurvivals.textContent = String(user.bunkerSurvivals ?? 0);
  profileBioView.textContent = user.bio?.trim() || "—";
  setAvatarSrc(user);
}

function showProfile(user) {
  currentUser = user;
  authSection.classList.add("hidden");
  profileSection.classList.remove("hidden");
  profileView.classList.remove("hidden");
  profileEditForm.classList.add("hidden");
  accountTagline.textContent = `Вы вошли как ${user.nickname}.`;
  fillProfileView(user);
  if (window.BunkerSocial) BunkerSocial.connect();
  if (window.BunkerSiteAuth) BunkerSiteAuth.refresh();
}

function enterEditMode() {
  profileView.classList.add("hidden");
  profileEditForm.classList.remove("hidden");
  showError(profileError, "");
  profileSuccess.classList.add("hidden");
  editNickname.value = currentUser.nickname;
  profileBio.value = currentUser.bio || "";
}

function showAuth() {
  currentUser = null;
  profileSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  accountTagline.textContent = "Регистрация, вход и профиль игрока.";
}

document.querySelectorAll(".auth-tabs__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".auth-tabs__btn").forEach((b) => {
      b.classList.toggle("auth-tabs__btn--active", b === btn);
    });
    const tab = btn.dataset.tab;
    loginForm.classList.toggle("hidden", tab !== "login");
    registerForm.classList.toggle("hidden", tab !== "register");
    showError(loginError, "");
    showError(registerError, "");
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(loginError, "");
  try {
    const user = await BunkerAuth.login(
      document.getElementById("loginNickname").value,
      document.getElementById("loginPassword").value
    );
    showProfile(user);
  } catch (err) {
    showError(loginError, err.message);
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(registerError, "");
  const p1 = document.getElementById("regPassword").value;
  const p2 = document.getElementById("regPassword2").value;
  if (p1 !== p2) {
    showError(registerError, "Пароли не совпадают.");
    return;
  }
  try {
    const user = await BunkerAuth.register(
      document.getElementById("regNickname").value,
      p1
    );
    showProfile(user);
  } catch (err) {
    showError(registerError, err.message);
  }
});

editProfileBtn.addEventListener("click", enterEditMode);

cancelEditBtn.addEventListener("click", () => {
  profileEditForm.classList.add("hidden");
  profileView.classList.remove("hidden");
});

profileEditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(profileError, "");
  profileSuccess.classList.add("hidden");
  try {
    const user = await BunkerAuth.updateProfile({
      bio: profileBio.value,
      nickname: editNickname.value.trim(),
    });
    showProfile(user);
    profileSuccess.textContent = "Профиль сохранён.";
    profileSuccess.classList.remove("hidden");
    setTimeout(() => profileSuccess.classList.add("hidden"), 3000);
  } catch (err) {
    showError(profileError, err.message);
  }
});

changeAvatarBtn.addEventListener("click", async () => {
  showError(profileError, "");
  try {
    const { dataUrl, crop } = await BunkerAvatarCrop.pickAndCrop();
    changeAvatarBtn.disabled = true;
    const user = await BunkerAuth.uploadAvatar(dataUrl, crop);
    currentUser = user;
    fillProfileView(user);
    setAvatarSrc(user, Date.now());
    if (window.BunkerSiteAuth) BunkerSiteAuth.refresh();
    profileSuccess.textContent = "Аватар обновлён.";
    profileSuccess.classList.remove("hidden");
  } catch (err) {
    if (err.message !== "cancel") {
      showError(profileError, err.message || "Не удалось загрузить фото.");
    }
  } finally {
    changeAvatarBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  BunkerAuth.clearAuth();
  showAuth();
  if (window.BunkerSiteAuth) BunkerSiteAuth.refresh();
});

(function applyTabFromUrl() {
  const tab = new URLSearchParams(location.search).get("tab");
  if (tab === "register") {
    document.querySelector('.auth-tabs__btn[data-tab="register"]')?.click();
  }
})();

(async function init() {
  if (!BunkerAuth.apiBase()) {
    accountTagline.textContent =
      "Для аккаунта нужен сервер: укажите apiUrl в config.js.";
    return;
  }
  const user = await BunkerAuth.fetchMe();
  if (user) showProfile(user);
  else showAuth();
})();
