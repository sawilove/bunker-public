(function () {
  const statusEl = document.getElementById("devStatus");
  const userQueryEl = document.getElementById("devUserQuery");
  const userInfoEl = document.getElementById("devUserInfo");
  const achievementIdEl = document.getElementById("devAchievementId");
  const achievementFilterEl = document.getElementById("devAchievementFilter");
  const achievementCatalogEl = document.getElementById("devAchievementCatalog");
  const sessionsOutputEl = document.getElementById("devSessionsOutput");
  const playerIdsOutputEl = document.getElementById("devPlayerIdsOutput");
  const maintenanceToggle = document.getElementById("devMaintenanceToggle");
  const maintenanceMsgEl = document.getElementById("devMaintenanceMsg");
  const premiumDaysEl = document.getElementById("devPremiumDays");

  let currentUser = null;
  let achievementCatalog = [];

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function userLine() {
    if (!currentUser) return "Пользователь не выбран.";
    const devFlag = currentUser.devFlag ?? currentUser.dev;
    const premFlag = currentUser.premiumFlag ?? currentUser.premium;
    const premEff = currentUser.premiumEffective ?? currentUser.premium;
    return [
      `${currentUser.nickname}`,
      `id=${currentUser.id}`,
      `profileId=${currentUser.profileId}`,
      `dev=${devFlag}`,
      `premium(flag)=${premFlag}`,
      `premium(активен)=${premEff}`,
      currentUser.premiumUntil ? `premiumUntil=${currentUser.premiumUntil}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
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

  async function setFlag(flag, value) {
    if (!requireSelectedUser()) return;
    const label = value ? "включить" : "выключить";
    if (!confirm(`${label} ${flag} для ${currentUser.nickname}?`)) return;
    const data = await BunkerAuth.devSetUserFlags(currentUser.id, { [flag]: value });
    currentUser = data.user;
    userInfoEl.textContent = userLine();
  }

  async function toggleFlag(flag) {
    if (!requireSelectedUser()) return;
    const current =
      flag === "dev"
        ? !!(currentUser.devFlag ?? currentUser.dev)
        : !!(currentUser.premiumFlag ?? currentUser.premium);
    await setFlag(flag, !current);
  }

  async function rotateProfileId() {
    if (!requireSelectedUser()) return;
    if (!confirm("Сгенерировать новый profileId?")) return;
    const data = await BunkerAuth.devRotateProfileId(currentUser.id);
    currentUser = data.user;
    userInfoEl.textContent = userLine();
  }

  async function grantPremiumDays() {
    if (!requireSelectedUser()) return;
    const days = parseInt(premiumDaysEl?.value || "30", 10);
    if (!Number.isFinite(days) || days < 1) {
      alert("Укажите число дней.");
      return;
    }
    await BunkerAuth.grantDevPremium(currentUser.id, days);
    await loadUser();
    alert(`Premium выдан на ${days} дн.`);
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

  function renderAchievementCatalog(filter = "") {
    if (!achievementCatalogEl) return;
    const q = filter.trim().toLowerCase();
    const list = achievementCatalog.filter(
      (a) =>
        !q ||
        a.id.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.typeLabel || "").toLowerCase().includes(q)
    );
    if (!list.length) {
      achievementCatalogEl.innerHTML = '<p class="field__hint">Ничего не найдено.</p>';
      return;
    }
    achievementCatalogEl.innerHTML = list
      .map(
        (a) =>
          `<button type="button" class="dev-achievement-catalog__item" data-ach-id="${a.id}" title="${a.description || ""}">
            <code class="dev-achievement-catalog__id">${a.id}</code>
            <span class="dev-achievement-catalog__name">${a.name}</span>
            <span class="dev-achievement-catalog__type">${a.typeLabel || a.type}</span>
          </button>`
      )
      .join("");
    achievementCatalogEl.querySelectorAll("[data-ach-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.achId;
        achievementIdEl.value = id;
        try {
          await navigator.clipboard.writeText(id);
          maintenanceMsgEl.textContent = `ID скопирован: ${id}`;
        } catch {
          maintenanceMsgEl.textContent = `Выбран id: ${id}`;
        }
      });
    });
  }

  async function loadAchievementCatalog() {
    const data = await BunkerAuth.devGetAchievementCatalog();
    achievementCatalog = data.achievements || [];
    renderAchievementCatalog(achievementFilterEl?.value || "");
  }

  async function loadMaintenance() {
    if (!maintenanceToggle) return;
    const data = await BunkerAuth.getDevSettings();
    maintenanceToggle.checked = !!data.maintenance;
  }

  async function onMaintenanceToggle() {
    const enabled = maintenanceToggle.checked;
    try {
      await BunkerAuth.setMaintenance(enabled);
      maintenanceMsgEl.textContent = enabled
        ? "Техобслуживание включено."
        : "Техобслуживание выключено.";
    } catch (err) {
      maintenanceToggle.checked = !enabled;
      maintenanceMsgEl.textContent = err.message;
    }
  }

  function bindDevPanelActions() {
    document.querySelector("[data-dev-catalog-scenarios]")?.addEventListener("click", () => {
      BunkerScenarioEditor?.openDevScenariosEditor?.();
    });
    document.querySelector("[data-dev-catalog-pools]")?.addEventListener("click", () => {
      BunkerScenarioEditor?.openDevCardPoolsEditor?.();
    });
    document.querySelector("[data-dev-scenario-mod]")?.addEventListener("click", () => {
      BunkerScenarioEditor?.openDevScenarioModeration?.();
    });
    document.querySelector("[data-dev-reports]")?.addEventListener("click", () => {
      if (window.BunkerDevPanel?.openReportsModal) {
        BunkerDevPanel.openReportsModal();
      }
    });
    document.querySelector("[data-dev-payments]")?.addEventListener("click", () => {
      if (window.BunkerDevPanel?.openPaymentsModal) {
        BunkerDevPanel.openPaymentsModal();
      }
    });
    document.getElementById("devOpenPanelBtn")?.addEventListener("click", () => {
      window.BunkerDevPanel?.open?.();
    });
  }

  function bind() {
    document.getElementById("devUserLoadBtn")?.addEventListener("click", () => {
      loadUser().catch((err) => alert(err.message));
    });
    document.getElementById("devSetDevOnBtn")?.addEventListener("click", () => {
      setFlag("dev", true).catch((err) => alert(err.message));
    });
    document.getElementById("devSetDevOffBtn")?.addEventListener("click", () => {
      setFlag("dev", false).catch((err) => alert(err.message));
    });
    document.getElementById("devSetPremiumOnBtn")?.addEventListener("click", () => {
      setFlag("premium", true).catch((err) => alert(err.message));
    });
    document.getElementById("devSetPremiumOffBtn")?.addEventListener("click", () => {
      setFlag("premium", false).catch((err) => alert(err.message));
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
    document.getElementById("devGrantPremiumBtn")?.addEventListener("click", () => {
      grantPremiumDays().catch((err) => alert(err.message));
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
    maintenanceToggle?.addEventListener("change", () => {
      onMaintenanceToggle().catch((err) => alert(err.message));
    });
    achievementFilterEl?.addEventListener("input", () => {
      renderAchievementCatalog(achievementFilterEl.value);
    });
    bindDevPanelActions();
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
      await Promise.all([loadMaintenance(), loadAchievementCatalog()]);
    } catch (err) {
      setStatus(err.message || "Ошибка загрузки.");
    }
  }

  init();
})();
