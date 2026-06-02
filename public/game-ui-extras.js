/** Shared in-game UI: vote stats, opened cards table, bunker survival */
(function () {
  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str == null ? "" : String(str);
    return el.innerHTML;
  }

  function formatCardLine(c) {
    if (c.type === "profession" && c.professionLevel) {
      return `${c.profession || c.value} — ${c.professionLevel}`;
    }
    if (c.type === "health" && c.condition) {
      return `${c.condition} — ${c.conditionLevel || c.value}`;
    }
    return c.value || "—";
  }

  function renderLastVoteStats(container, result, opts = {}) {
    if (!container) return;
    if (!result?.tallies?.length) {
      container.innerHTML = "";
      if (!opts.alwaysShow) container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    const maxVotes = Math.max(...result.tallies.map((t) => t.votes), 1);
    const bars = result.tallies
      .map((t) => {
        const pct = Math.round((t.votes / maxVotes) * 100);
        return `<div class="vote-stat-row">
          <span class="vote-stat-row__name">${escapeHtml(t.name)}</span>
          <div class="vote-stat-row__bar-wrap"><div class="vote-stat-row__bar" style="width:${pct}%"></div></div>
          <span class="vote-stat-row__count">${t.votes}</span>
        </div>`;
      })
      .join("");
    const tieNote = result.tie
      ? `<p class="vote-stat__note vote-stat__note--tie">Ничья: переголосование только среди ${escapeHtml((result.tieCandidateNames || []).join(", "))}.</p>`
      : "";
    const excluded = result.excludedName
      ? `<p class="vote-stat__note">Исключён: <strong>${escapeHtml(result.excludedName)}</strong></p>`
      : "";
    const roundLabel = result.tie
      ? "итог переголосования (ничья)"
      : result.revoteRound
        ? `итог голосования (раунд переголосования #${result.revoteRound})`
        : "итог голосования";
    container.innerHTML = `
      <p class="vote-stat__title">Итоги последнего голосования</p>
      <p class="vote-stat__meta">${escapeHtml(roundLabel)} · голосов: ${result.totalVotes || 0} / ${result.votersNeeded || "—"}</p>
      <div class="vote-stat__bars">${bars}</div>
      ${tieNote}
      ${excluded}`;
  }

  function renderFoodStayAnalysis(fs) {
    if (!fs || fs.pending) return "";
    const cov = fs.bunkerCoverage != null ? fs.bunkerCoverage.toFixed(2) : "—";
    const perCap = fs.perCapitaRatio != null ? fs.perCapitaRatio.toFixed(2) : "—";
    const adj = fs.adjustedCoverage != null ? fs.adjustedCoverage.toFixed(2) : "—";
    const statusClass = `food-stay--${fs.status || "unknown"}`;
    const lines = (fs.analysis || [])
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("");
    return `
      <div class="food-stay-analysis ${statusClass}">
        <p class="food-stay-analysis__title">Баланс еды и срока в бункере</p>
        <div class="food-stay-analysis__metrics">
          <span class="food-stay-metric">Еда/срок: <strong>×${cov}</strong></span>
          <span class="food-stay-metric">На душу: <strong>×${perCap}</strong></span>
          <span class="food-stay-metric">С учётом мест: <strong>×${adj}</strong></span>
        </div>
        <ul class="food-stay-analysis__list">${lines}</ul>
      </div>`;
  }

  function renderOpenedCardsPanel(container, rows) {
    if (!container) return;
    if (!rows?.length) {
      container.innerHTML = '<p class="opened-cards-panel__empty">Пока никто не открыл карты на стол.</p>';
      return;
    }
    const tableRows = rows
      .map((row) => {
        const cardsHtml = row.opened.length
          ? row.opened
              .map(
                (c) =>
                  `<span class="opened-cards-panel__chip"><span class="opened-cards-panel__chip-label">${escapeHtml(c.label)}</span> ${escapeHtml(formatCardLine(c))}</span>`
              )
              .join("")
          : '<span class="opened-cards-panel__chip opened-cards-panel__chip--muted">—</span>';
        const excl = row.excluded
          ? ' <span class="status-badge status-badge--excluded-inline">искл.</span>'
          : "";
        return `<tr>
          <th scope="row" class="opened-cards-panel__player">${escapeHtml(row.name)}${excl}</th>
          <td class="opened-cards-panel__cards">${cardsHtml}</td>
        </tr>`;
      })
      .join("");
    container.innerHTML = `
      <div class="opened-cards-panel__scroll">
        <table class="opened-cards-panel__table">
          <thead><tr><th>Игрок</th><th>Открытые карты</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
  }

  function renderBunkerSurvival(container, data) {
    if (!container || !data) {
      if (container) {
        container.innerHTML = "";
        container.classList.add("hidden");
      }
      return;
    }
    container.classList.remove("hidden");
    const criteriaHtml = (data.criteria || [])
      .map((c) => {
        const cls = c.pass ? "survival-criterion--pass" : "survival-criterion--fail";
        const icon = c.pass ? "✓" : "✗";
        return `<li class="survival-criterion ${cls}">
          <span class="survival-criterion__icon" aria-hidden="true">${icon}</span>
          <div class="survival-criterion__body">
            <span class="survival-criterion__label">${escapeHtml(c.label)} <em>(${c.weight}%)</em></span>
            <span class="survival-criterion__detail">${escapeHtml(c.detail)}</span>
          </div>
        </li>`;
      })
      .join("");
    const foodStayBlock = renderFoodStayAnalysis(data.foodStayAnalysis);
    const demo = data.demographics;
    const demoLine = demo
      ? `<p class="survival-score__demo">Демография: ♂ ${demo.males} · ♀ ${demo.females} · репр. возраст ♂${demo.reproMale}/♀${demo.reproFemale}${demo.ages?.length ? ` · возраста: ${demo.ages.join(", ")}` : ""}</p>`
      : "";
    container.innerHTML = `
      <div class="survival-score">
        <div class="survival-score__ring" style="--score:${data.score}">
          <span class="survival-score__value">${data.score}</span>
        </div>
        <div class="survival-score__summary">
          <p class="survival-score__verdict">${escapeHtml(data.verdict)}</p>
          <p class="survival-score__meta">Выживших: ${data.survivorsCount} · мест в бункере: ${data.bunkerSpots}</p>
          ${demoLine}
        </div>
      </div>
      ${foodStayBlock}
      <ul class="survival-score__criteria">${criteriaHtml}</ul>`;
  }

  window.BunkerGameUiExtras = {
    renderLastVoteStats,
    renderOpenedCardsPanel,
    renderBunkerSurvival,
    formatCardLine,
  };
})();
