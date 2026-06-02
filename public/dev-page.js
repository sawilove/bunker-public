(function () {
  const statusEl = document.getElementById("devStatus");
  const userQueryEl = document.getElementById("devUserQuery");
  const userInfoEl = document.getElementById("devUserInfo");
  const achievementIdEl = document.getElementById("devAchievementId");
  const sessionsOutputEl = document.getElementById("devSessionsOutput");
  const playerIdsOutputEl = document.getElementById("devPlayerIdsOutput");

  let currentUser = null;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function userLine() {
    if (!currentUser) return "Пользователь не выбран.";
    return `${currentUser.nickname} | id=${currentUser.id} | profileId=${currentUser.profileId} | dev=${currentUser.dev} | premium=${currentUser.premium}`;
  }

  function requireSelectedUser() {
    if (currentUser) return true;
    alert("Сначала выберите пользователя.");
    return false;
  }

  async function loadUser() {
    const query = (userQueryEl.value || "").trim();
    if (!query) return;
    const data = await BunkerAuth.devFindUser(query);
    currentUser = data.user || null;
    userInfoEl.textContent = userLine();
  }

  async function toggleFlag(flag) {
    if (!requireSelectedUser()) return;
    if (!confirm(`Переключить флаг ${flag} для ${currentUser.nickname}?`)) return;
    const data = await BunkerAuth.devSetUserFlags(currentUser.id, {
      [flag]: !currentUser[flag],
    });
    currentUser = data.user;
    userInfoEl.textContent = userLine();
  }

  async function rotateProfileId() {
    if (!requireSelectedUser()) return;
    if (!confirm("Сгенерировать новый profileId?")) return;
    const data = await BunkerAuth.devRotateProfileId(currentUser.id);
    currentUser = data.user;
    userInfoEl.textContent = userLine();
  }

  async function grantAchievement() {
    if (!requireSelectedUser()) return;
    const achievementId = (achievementIdEl.value || "").trim();
    if (!achievementId) return;
    await BunkerAuth.devGrantAchievement(currentUser.id, achievementId);
    alert(`Достижение ${achievementId} выдано.`);
  }

  async function revokeAchievement() {
    if (!requireSelectedUser()) return;
    const achievementId = (achievementIdEl.value || "").trim();
    if (!achievementId) return;
    await BunkerAuth.devRevokeAchievement(currentUser.id, achievementId);
    alert(`Достижение ${achievementId} удалено.`);
  }

  async function showSession() {
    const data = await BunkerAuth.devGetSessionState();
    sessionsOutputEl.textContent = JSON.stringify(data, null, 2);
  }

  async function endSession() {
    if (!confirm("Завершить активную сессию?")) return;
    await BunkerAuth.devEndSession();
    await showSession();
  }

  async function resetLobby() {
    if (!confirm("Сбросить активную сессию в лобби?")) return;
    await BunkerAuth.devResetToLobby();
    await showSession();
  }

  async function showPlayerIds() {
    const data = await BunkerAuth.devListSessionPlayerIds();
    playerIdsOutputEl.textContent = JSON.stringify(data, null, 2);
  }

  function bind() {
    document.getElementById("devUserLoadBtn")?.addEventListener("click", () => {
      loadUser().catch((err) => alert(err.message));
    });
    document.getElementById("devToggleDevBtn")?.addEventListener("click", () => {
      toggleFlag("dev").catch((err) => alert(err.message));
    });
    document.getElementById("devTogglePremiumBtn")?.addEventListener("click", () => {
      toggleFlag("premium").catch((err) => alert(err.message));
    });
    document.getElementById("devRotateProfileBtn")?.addEventListener("click", () => {
      rotateProfileId().catch((err) => alert(err.message));
    });
    document.getElementById("devGrantAchievementBtn")?.addEventListener("click", () => {
      grantAchievement().catch((err) => alert(err.message));
    });
    document.getElementById("devRevokeAchievementBtn")?.addEventListener("click", () => {
      revokeAchievement().catch((err) => alert(err.message));
    });
    document.getElementById("devSessionsBtn")?.addEventListener("click", () => {
      showSession().catch((err) => alert(err.message));
    });
    document.getElementById("devEndSessionBtn")?.addEventListener("click", () => {
      endSession().catch((err) => alert(err.message));
    });
    document.getElementById("devResetLobbyBtn")?.addEventListener("click", () => {
      resetLobby().catch((err) => alert(err.message));
    });
    document.getElementById("devPlayerIdsBtn")?.addEventListener("click", () => {
      showPlayerIds().catch((err) => alert(err.message));
    });
  }

  async function init() {
    try {
      const me = await BunkerAuth.fetchMe();
      if (!me?.dev) {
        setStatus("Доступ запрещен: требуется dev=true.");
        location.replace(BunkerAuth.pageUrl("index.html"));
        return;
      }
      setStatus(`Вход выполнен: ${me.nickname}`);
      bind();
    } catch (err) {
      setStatus(err.message || "Ошибка загрузки.");
    }
  }

  init();
})();
