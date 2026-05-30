(function () {
  const metricSelect = document.getElementById("metricSelect");
  const scopeSelect = document.getElementById("scopeSelect");
  const reloadBtn = document.getElementById("reloadBtn");
  const leaderboardList = document.getElementById("leaderboardList");
  const myRankEl = document.getElementById("myRank");
  const activityScope = document.getElementById("activityScope");
  const activityFeed = document.getElementById("activityFeed");

  function metricLabel(metric) {
    if (metric === "games") return "партий";
    if (metric === "scenarios") return "сценариев";
    return "выживаний";
  }

  function renderLeaderboard(data) {
    if (!data.entries?.length) {
      leaderboardList.innerHTML = '<li class="leaderboard-list__empty">Пока никого нет в рейтинге.</li>';
    } else {
      leaderboardList.innerHTML = data.entries
        .map((e) => {
          const av = BunkerAuth.assetUrl(e.avatarUrl || "/icons/default-avatar.svg");
          const href = BunkerAuth.profileUrl({ profileId: e.profileId, id: e.userId });
          return `<li class="leaderboard-list__item">
            <span class="leaderboard-list__rank">#${e.rank}</span>
            <a href="${href}"><img class="leaderboard-list__avatar" src="${av}" alt=""></a>
            <a href="${href}" class="leaderboard-list__name">${BunkerUserBadges.escapeHtml(e.nickname)}</a>
            <span class="leaderboard-list__score">${e.score} ${metricLabel(data.metric)}</span>
          </li>`;
        })
        .join("");
    }

    if (data.me) {
      myRankEl.textContent = `Ваша позиция: #${data.me.rank} (${data.me.score} ${metricLabel(data.metric)})`;
      myRankEl.classList.remove("hidden");
    } else {
      myRankEl.classList.add("hidden");
    }
  }

  function activityText(ev) {
    const name = ev.user?.nickname || "Игрок";
    const p = ev.payload || {};
    if (ev.type === "achievement_unlock") {
      return `${name} получил достижение «${p.name || p.achievementId || ""}»`;
    }
    if (ev.type === "scenario_published") {
      return `${name} опубликовал сценарий «${p.title || ""}»`;
    }
    if (ev.type === "survival_milestone") {
      return `${name} достиг ${p.totalSurvivals} выживаний`;
    }
    return `${name}: ${ev.type}`;
  }

  function renderActivity(events) {
    if (!events?.length) {
      activityFeed.innerHTML = '<li class="activity-feed__empty">Пока нет событий.</li>';
      return;
    }
    activityFeed.innerHTML = events
      .map((ev) => {
        const href = ev.user ? BunkerAuth.profileUrl(ev.user) : "#";
        const time = new Date(ev.createdAt).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<li class="activity-feed__item">
          <a href="${href}" class="activity-feed__text">${BunkerUserBadges.escapeHtml(activityText(ev))}</a>
          <time class="activity-feed__time">${time}</time>
        </li>`;
      })
      .join("");
  }

  async function loadLeaderboard() {
    try {
      const data = await BunkerAuth.getLeaderboard(
        metricSelect.value,
        scopeSelect.value
      );
      renderLeaderboard(data);
    } catch (err) {
      leaderboardList.innerHTML = `<li class="leaderboard-list__empty">${BunkerUserBadges.escapeHtml(err.message)}</li>`;
    }
  }

  async function loadActivity() {
    try {
      const data = await BunkerAuth.getActivity(activityScope.value);
      renderActivity(data.events);
    } catch (err) {
      activityFeed.innerHTML = `<li class="activity-feed__empty">${BunkerUserBadges.escapeHtml(err.message)}</li>`;
    }
  }

  reloadBtn?.addEventListener("click", () => {
    loadLeaderboard();
    loadActivity();
  });
  metricSelect?.addEventListener("change", loadLeaderboard);
  scopeSelect?.addEventListener("change", loadLeaderboard);
  activityScope?.addEventListener("change", loadActivity);

  window.addEventListener("bunker:auth-ready", () => {
    loadLeaderboard();
    loadActivity();
  });
})();
