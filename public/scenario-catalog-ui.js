(function () {
  const SORT_OPTIONS = [
    { id: "relevance", label: "По релевантности" },
    { id: "rating", label: "По рейтингу" },
    { id: "plays", label: "По популярности (игры)" },
    { id: "newest", label: "Сначала новые" },
    { id: "oldest", label: "Сначала старые" },
  ];

  function ratingAvgFromScenario(b) {
    if (b.ratingAvg != null) return Number(b.ratingAvg);
    const c = b.ratingCount || 0;
    if (!c) return null;
    return Math.round((Number(b.ratingSum || 0) / c) * 10) / 10;
  }

  function publishedTs(b) {
    const t = b.publishedAt || b.reviewedAt || b.updatedAt;
    return t ? new Date(t).getTime() : 0;
  }

  function relevanceScore(b) {
    const plays = b.playCount || 0;
    const avg = ratingAvgFromScenario(b) || 0;
    const votes = b.ratingCount || 0;
    const days = Math.max(0, (Date.now() - publishedTs(b)) / 86400000);
    const recency = Math.exp(-days / 60);
    const ratingPart = votes > 0 ? avg * Math.log1p(votes) : 0;
    return Math.log1p(plays) * 1.4 + ratingPart * 0.9 + recency * 2.5;
  }

  function sortScenarios(list, sort) {
    const key = SORT_OPTIONS.some((o) => o.id === sort) ? sort : "relevance";
    const items = [...(list || [])];
    items.sort((a, b) => {
      if (key === "rating") {
        const d = (ratingAvgFromScenario(b) || 0) - (ratingAvgFromScenario(a) || 0);
        if (d !== 0) return d;
        return (b.ratingCount || 0) - (a.ratingCount || 0);
      }
      if (key === "plays") return (b.playCount || 0) - (a.playCount || 0);
      if (key === "newest") return publishedTs(b) - publishedTs(a);
      if (key === "oldest") return publishedTs(a) - publishedTs(b);
      return relevanceScore(b) - relevanceScore(a);
    });
    return items;
  }

  function formatRatingBadge(b) {
    const avg = ratingAvgFromScenario(b);
    const count = b.ratingCount || 0;
    if (!count || avg == null) {
      return `<span class="scenario-card__rating scenario-card__rating--empty" title="Пока нет оценок">★ —</span>`;
    }
    return `<span class="scenario-card__rating" title="Средняя оценка (${count})">★ ${avg.toFixed(1)} <span class="scenario-card__rating-count">(${count})</span></span>`;
  }

  function sortSelectHtml(current, extraClass) {
    const cls = extraClass ? ` ${extraClass}` : "";
    const opts = SORT_OPTIONS.map(
      (o) =>
        `<option value="${o.id}"${o.id === current ? " selected" : ""}>${o.label}</option>`
    ).join("");
    return `<label class="scenario-catalog-sort${cls}">
      <span class="scenario-catalog-sort__label">Сортировка</span>
      <select data-scenario-sort>${opts}</select>
    </label>`;
  }

  function bindSortSelect(root, onChange) {
    const sel = root.querySelector("[data-scenario-sort]");
    if (!sel) return;
    sel.addEventListener("change", () => onChange(sel.value));
  }

  function renderStarRating(catalogId, yourRating, disabled) {
    const stars = [1, 2, 3, 4, 5]
      .map((n) => {
        const filled = yourRating != null && n <= yourRating;
        return `<button type="button" class="scenario-rate__star${filled ? " scenario-rate__star--on" : ""}" data-rate-star="${n}" ${disabled ? "disabled" : ""} aria-label="Оценка ${n}">★</button>`;
      })
      .join("");
    return `<div class="scenario-rate" data-rate-catalog="${catalogId || ""}">
      <p class="scenario-rate__label">Оцените сценарий катастрофы</p>
      <div class="scenario-rate__stars" role="group" aria-label="Оценка от 1 до 5">${stars}</div>
      <p class="scenario-rate__hint hidden" data-rate-thanks>Спасибо за оценку!</p>
      <p class="form-error hidden" data-rate-error></p>
    </div>`;
  }

  function bindStarRating(root, onRate) {
    const wrap = root.querySelector(".scenario-rate");
    if (!wrap || wrap.dataset.bound === "1") return;
    wrap.dataset.bound = "1";
    wrap.querySelectorAll("[data-rate-star]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        const rating = Number(btn.dataset.rateStar);
        const errEl = wrap.querySelector("[data-rate-error]");
        const thanks = wrap.querySelector("[data-rate-thanks]");
        errEl?.classList.add("hidden");
        try {
          await onRate(rating);
          wrap.querySelectorAll("[data-rate-star]").forEach((b) => {
            const n = Number(b.dataset.rateStar);
            b.classList.toggle("scenario-rate__star--on", n <= rating);
            b.disabled = true;
          });
          thanks?.classList.remove("hidden");
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message || "Не удалось отправить оценку.";
            errEl.classList.remove("hidden");
          }
        }
      });
    });
  }

  window.BunkerScenarioCatalogUi = {
    SORT_OPTIONS,
    sortScenarios,
    formatRatingBadge,
    sortSelectHtml,
    bindSortSelect,
    renderStarRating,
    bindStarRating,
    ratingAvgFromScenario,
  };
})();
