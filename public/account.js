const authSection = document.getElementById("authSection");
const profileSection = document.getElementById("profileSection");
const accountTagline = document.getElementById("accountTagline");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const profileError = document.getElementById("profileError");
const profileSuccess = document.getElementById("profileSuccess");
const profileAvatar = document.getElementById("profileAvatar");
const profileNickname = document.getElementById("profileNickname");
const profileBadges = document.getElementById("profileBadges");
const profileStatus = document.getElementById("profileStatus");
const profileAvatarWrap = document.querySelector(".profile-avatar-wrap");
const statGames = document.getElementById("statGames");
const statSurvivals = document.getElementById("statSurvivals");
const profileBio = document.getElementById("profileBio");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
const logoutBtn = document.getElementById("logoutBtn");

function showError(el, msg) {
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function setAvatarSrc(user) {
  const url = user?.avatarUrl
    ? BunkerAuth.assetUrl(user.avatarUrl)
    : BunkerAuth.assetUrl("/icons/default-avatar.svg");
  profileAvatar.src = url;
  if (profileAvatarWrap) {
    profileAvatarWrap.className = `profile-avatar-wrap ${BunkerUserBadges.frameClass(user)}`;
  }
}

function showProfile(user) {
  authSection.classList.add("hidden");
  profileSection.classList.remove("hidden");
  accountTagline.textContent = `Вы вошли как ${user.nickname}.`;
  profileNickname.textContent = user.nickname;
  if (profileBadges) profileBadges.innerHTML = BunkerUserBadges.roleBadgesHtml(user);
  if (profileStatus) profileStatus.innerHTML = BunkerUserBadges.statusHtml(user);
  statGames.textContent = String(user.gamesPlayed ?? 0);
  statSurvivals.textContent = String(user.bunkerSurvivals ?? 0);
  profileBio.value = user.bio || "";
  setAvatarSrc(user);
  if (window.BunkerSocial) BunkerSocial.connect();
}

function showAuth() {
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

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(profileError, "");
  showError(profileSuccess, "");
  try {
    const user = await BunkerAuth.updateProfile(profileBio.value);
    showProfile(user);
    profileSuccess.textContent = "Профиль сохранён.";
    profileSuccess.classList.remove("hidden");
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
    showProfile(user);
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
