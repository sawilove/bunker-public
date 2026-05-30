(function () {
  const TOAST_MS = 5000;
  const STORAGE = "bunker:notifications";

  let toastEl = null;
  let queue = [];
  let showing = false;
  const shownToastKeys = new Set();

  function escapeHtml(s) {
    const el = document.createElement("div");
    el.textContent = s || "";
    return el.innerHTML;
  }

  function assetUrl(path) {
    if (!path) return "";
    if (window.BunkerAuth?.assetUrl) return BunkerAuth.assetUrl(path);
    return path;
  }

  function achievementsHref() {
    return window.BunkerAuth?.pageUrl?.("achievements.html") || "/achievements.html";
  }

  function ensureToastEl() {
    if (toastEl) return toastEl;
    toastEl = document.getElementById("achievementUnlockToast");
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "achievementUnlockToast";
      toastEl.className = "achievement-unlock-toast hidden";
      toastEl.setAttribute("role", "alert");
      document.body.appendChild(toastEl);
    }
    return toastEl;
  }

  function isAlreadyNotified(id) {
    const key = `achievement_unlock:${id}`;
    try {
      const items = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      return items.some((i) => i.dedupeKey === key);
    } catch {
      return false;
    }
  }

  function addToNotifications(ach) {
    if (!window.BunkerNotifications) return;
    BunkerNotifications.add({
      type: "achievement_unlock",
      title: "Достижение получено",
      body: ach.name,
      href: achievementsHref(),
      iconUrl: ach.iconUrl,
      dedupeKey: `achievement_unlock:${ach.id}`,
    });
  }

  function showNextToast() {
    if (showing || !queue.length) return;
    showing = true;
    const ach = queue.shift();
    const el = ensureToastEl();
    const icon = assetUrl(ach.iconUrl || "");
    el.innerHTML = `
      <div class="achievement-unlock-toast__inner">
        <img class="achievement-unlock-toast__medal" src="${escapeHtml(icon)}" alt="">
        <div class="achievement-unlock-toast__text">
          <p class="achievement-unlock-toast__label">Достижение получено</p>
          <p class="achievement-unlock-toast__name">${escapeHtml(ach.name)}</p>
        </div>
        <button type="button" class="achievement-unlock-toast__close" aria-label="Закрыть">×</button>
      </div>`;
    el.classList.remove("hidden");
    let timer = null;
    const close = () => {
      if (timer) clearTimeout(timer);
      el.classList.add("hidden");
      showing = false;
      if (queue.length) showNextToast();
    };
    el.querySelector(".achievement-unlock-toast__close").onclick = close;
    timer = setTimeout(close, TOAST_MS);
  }

  function process(unlocks) {
    if (!unlocks?.length) return;
    for (const ach of unlocks) {
      if (!ach?.id) continue;
      const toastKey = `achievement_unlock:${ach.id}`;
      if (shownToastKeys.has(toastKey)) continue;
      if (isAlreadyNotified(ach.id)) {
        shownToastKeys.add(toastKey);
        continue;
      }
      shownToastKeys.add(toastKey);
      addToNotifications(ach);
      queue.push(ach);
    }
    showNextToast();
  }

  window.BunkerAchievementUnlocks = { process };
})();
