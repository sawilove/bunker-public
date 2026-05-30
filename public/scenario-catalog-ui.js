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

  function parseCatalogId(backstoryId) {
    if (!backstoryId || !String(backstoryId).startsWith("catalog:")) return null;
    return String(backstoryId).slice("catalog:".length);
  }

  function socialHoverHtml(backstoryId) {
    const id = parseCatalogId(backstoryId);
    if (!id) return "";
    return `<span class="scenario-card__hover-actions">
      <button type="button" class="scenario-card__hover-btn" data-scenario-fav="${id}" title="В избранное" aria-label="В избранное">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
      </button>
      <button type="button" class="scenario-card__hover-btn" data-scenario-comments="${id}" title="Комментарии" aria-label="Комментарии">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
    </span>`;
  }

  async function openCommentsModal(catalogId) {
    if (!window.BunkerAuth?.isLoggedIn?.()) {
      alert("Войдите в аккаунт для комментариев.");
      return;
    }
    let modal = document.getElementById("scenarioCommentsModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "scenarioCommentsModal";
      modal.className = "scenario-comments-modal hidden";
      modal.innerHTML = `<div class="scenario-comments-modal__card panel">
        <button type="button" class="scenario-comments-modal__close" aria-label="Закрыть">×</button>
        <h3>Комментарии</h3>
        <ul class="scenario-comments-list" id="scenarioCommentsList"></ul>
        <form id="scenarioCommentForm" class="scenario-comment-form">
          <textarea id="scenarioCommentInput" maxlength="1000" rows="3" placeholder="Ваш комментарий…"></textarea>
          <button type="submit" class="btn btn--small btn--amber">Отправить</button>
        </form>
        <p class="form-error hidden" id="scenarioCommentError"></p>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.add("hidden");
      });
      modal.querySelector(".scenario-comments-modal__close").addEventListener("click", () => {
        modal.classList.add("hidden");
      });
    }
    modal.dataset.catalogId = catalogId;
    modal.classList.remove("hidden");
    const listEl = modal.querySelector("#scenarioCommentsList");
    const errEl = modal.querySelector("#scenarioCommentError");
    async function loadComments() {
      try {
        const data = await BunkerAuth.getScenarioComments(catalogId);
        if (!data.comments?.length) {
          listEl.innerHTML = '<li class="scenario-comments-list__empty">Пока нет комментариев.</li>';
          return;
        }
        listEl.innerHTML = data.comments
          .map(
            (c) => `<li class="scenario-comments-list__item">
              <strong>${escapeHtml(c.user?.nickname || "Игрок")}</strong>
              <p>${escapeHtml(c.body)}</p>
            </li>`
          )
          .join("");
      } catch (err) {
        listEl.innerHTML = `<li class="scenario-comments-list__empty">${escapeHtml(err.message)}</li>`;
      }
    }
    function escapeHtml(s) {
      const el = document.createElement("div");
      el.textContent = s || "";
      return el.innerHTML;
    }
    modal.querySelector("#scenarioCommentForm").onsubmit = async (e) => {
      e.preventDefault();
      errEl.classList.add("hidden");
      const input = modal.querySelector("#scenarioCommentInput");
      try {
        await BunkerAuth.addScenarioComment(catalogId, input.value);
        input.value = "";
        await loadComments();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
      }
    };
    await loadComments();
  }

  function bindScenarioSocial(root) {
    root.querySelectorAll("[data-scenario-fav]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!window.BunkerAuth?.isLoggedIn?.()) {
          alert("Войдите в аккаунт.");
          return;
        }
        try {
          const result = await BunkerAuth.toggleScenarioFavorite(btn.dataset.scenarioFav);
          btn.classList.toggle("scenario-card__hover-btn--on", result.favorited);
          btn.querySelector("svg")?.setAttribute("fill", result.favorited ? "currentColor" : "none");
        } catch (err) {
          alert(err.message);
        }
      });
    });
    root.querySelectorAll("[data-scenario-comments]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openCommentsModal(btn.dataset.scenarioComments);
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
    socialHoverHtml,
    bindScenarioSocial,
    openCommentsModal,
  };
})();
