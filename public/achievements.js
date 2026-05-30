(function () {
  const content = document.getElementById("achievementsContent");
  const summary = document.getElementById("achievementsSummary");
  const unlockedEl = document.getElementById("achievementsUnlockedCount");
  const totalEl = document.getElementById("achievementsTotalCount");

  const TYPE_ORDER = ["once", "unique", "goal"];
  const TYPE_LABELS = {
    once: "Разовые",
    unique: "Уникальные",
    goal: "Целевые",
  };

  function groupByType(achievements) {
    const groups = {};
    for (const ach of achievements) {
      if (!groups[ach.type]) groups[ach.type] = [];
      groups[ach.type].push(ach);
    }
    return groups;
  }

  function render(data) {
    const achievements = data.achievements || [];
    const unlocked = achievements.filter((a) => a.unlocked).length;
    summary.classList.remove("hidden");
    unlockedEl.textContent = String(unlocked);
    totalEl.textContent = String(achievements.length);

    const groups = groupByType(achievements);
    const sections = TYPE_ORDER.filter((t) => groups[t]?.length).map((type) => {
      const cards = groups[type].map((a) => BunkerAchievementsUi.cardHtml(a)).join("");
      return `<section class="panel achievements-section">
        <p class="panel__title">${BunkerUserBadges.escapeHtml(TYPE_LABELS[type])}</p>
        <div class="achievements-grid">${cards}</div>
      </section>`;
    });

    content.innerHTML = sections.join("") || `<p class="panel">Достижений пока нет.</p>`;
  }

  async function init() {
    if (!BunkerAuth.apiBase()) {
      content.innerHTML = `<section class="panel"><p>Настройте API в config.js.</p></section>`;
      return;
    }
    const token = BunkerAuth.getToken();
    if (!token) {
      const loginUrl = BunkerAuth.pageUrl(`auth.html?tab=login&next=${encodeURIComponent(BunkerAuth.pageUrl("achievements.html"))}`);
      content.innerHTML = `<section class="panel">
        <p>Войдите, чтобы видеть свои достижения.</p>
        <a href="${BunkerUserBadges.escapeHtml(loginUrl)}" class="btn btn--amber">Войти</a>
      </section>`;
      return;
    }
    try {
      const data = await BunkerAuth.getAchievements();
      if (data.newlyUnlocked?.length) {
        window.BunkerAchievementUnlocks?.process(data.newlyUnlocked);
      }
      render(data);
    } catch (err) {
      content.innerHTML = `<section class="panel"><p class="form-error">${BunkerUserBadges.escapeHtml(err.message)}</p></section>`;
    }
  }

  init();
})();
