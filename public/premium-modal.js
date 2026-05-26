(function () {
  const ICONS = {
    crown: `<svg class="premium-benefit__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18l-2.2-10-4.3 4-3.5-6-3.5 6-4.3-4L3 18z"/></svg>`,
    banner: `<svg class="premium-benefit__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>`,
    lock: `<svg class="premium-benefit__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
    clock: `<svg class="premium-benefit__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    card: `<svg class="premium-benefit__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
    copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    pay: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    back: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`,
    day: `<svg class="premium-plan__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    week: `<svg class="premium-plan__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg>`,
    month: `<svg class="premium-plan__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h8M8 18h5"/></svg>`,
    year: `<svg class="premium-plan__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l2.4 4.8 5.4.8-3.9 3.8.9 5.3L12 15.8 7.2 17.7l.9-5.3L4.2 8.6l5.4-.8L12 3z"/></svg>`,
  };

  const PLANS = [
    { id: "1d", label: "1 день", days: 1, price: 49, icon: "day" },
    { id: "7d", label: "7 дней", days: 7, price: 199, tag: "Попробовать", icon: "week" },
    { id: "30d", label: "30 дней", days: 30, price: 499, tag: "Выгодно", featured: true, icon: "month" },
    { id: "365d", label: "1 год", days: 365, price: 2990, tag: "Максимум", icon: "year" },
  ];

  const BENEFITS = [
    { icon: "crown", text: "Золотая рамка аватара и значок ♛ Премиум в профиле, друзьях и в игре" },
    { icon: "banner", text: "Персональный баннер на странице профиля" },
    { icon: "lock", text: "Скрытие списка друзей от других игроков" },
    { icon: "clock", text: "Приоритетная активация после оплаты (вручную, обычно до 24 часов)" },
  ];

  function benefitsHtml() {
    return BENEFITS.map(
      (b) => `<li>${ICONS[b.icon] || ""}<span>${b.text}</span></li>`
    ).join("");
  }

  let overlay = null;
  let currentUser = null;
  let selectedPlan = null;

  function formatRub(n) {
    return `${n.toLocaleString("ru-RU")} ₽`;
  }

  function perDayPrice(plan) {
    if (plan.days <= 1) return null;
    return Math.round(plan.price / plan.days);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "premium-modal hidden";
    overlay.setAttribute("role", "presentation");
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    return overlay;
  }

  function planCardHtml(plan) {
    const perDay = perDayPrice(plan);
    const perDayHtml = perDay
      ? `<span class="premium-plan__per-day">≈ ${perDay} ₽/день</span>`
      : "";
    const tagHtml = plan.tag
      ? `<span class="premium-plan__tag${plan.featured ? " premium-plan__tag--featured" : ""}">${plan.tag}</span>`
      : "";
    const featured = plan.featured ? " premium-plan--featured" : "";
    return `
      <button type="button" class="premium-plan${featured}" data-plan-id="${plan.id}">
        ${tagHtml}
        <span class="premium-plan__head">
          ${ICONS[plan.icon] || ICONS.day}
          <span class="premium-plan__label">${plan.label}</span>
        </span>
        <span class="premium-plan__price">${formatRub(plan.price)}</span>
        ${perDayHtml}
      </button>`;
  }

  function renderMain() {
    const isPremium = !!currentUser?.premium;
    const plansHtml = PLANS.map(planCardHtml).join("");

    return `
      <div class="premium-modal__card panel" role="dialog" aria-modal="true" aria-labelledby="premiumModalTitle">
        <button type="button" class="premium-modal__close" aria-label="Закрыть">×</button>
        <p class="premium-modal__badge">${ICONS.crown} Премиум</p>
        <h2 id="premiumModalTitle" class="premium-modal__title-row">
          ${ICONS.crown.replace("premium-benefit__icon", "premium-modal__title-icon")}
          <span class="premium-modal__title">Подписка Премиум</span>
        </h2>
        <p class="premium-modal__lead">
          Оформите доступ к статусу выжившего элиты. Оплата через СБП или карту — премиум активируем на ваш аккаунт после подтверждения платежа.
        </p>
        ${
          isPremium
            ? `<p class="premium-modal__active">У вас уже активен Премиум. Продление суммируется с текущим сроком после оплаты.</p>`
            : ""
        }
        <ul class="premium-modal__benefits">
          ${benefitsHtml()}
        </ul>
        <p class="premium-modal__plans-title">Выберите срок</p>
        <div class="premium-modal__plans">${plansHtml}</div>
        <p class="premium-modal__footnote">Цены в рублях. Нажмите тариф, чтобы перейти к оплате.</p>
      </div>`;
  }

  function esc(str) {
    return window.BunkerUserBadges?.escapeHtml(str) || String(str || "");
  }

  function renderCheckout(plan) {
    const nick = currentUser?.nickname || "—";
    const paymentComment = `Премиум ${plan.label} — ${nick}`;
    return `
      <div class="premium-modal__card panel" role="dialog" aria-modal="true" aria-labelledby="premiumCheckoutTitle">
        <button type="button" class="premium-modal__close" aria-label="Закрыть">×</button>
        <button type="button" class="premium-modal__back">${ICONS.back} К тарифам</button>
        <h2 id="premiumCheckoutTitle" class="premium-modal__title-row">
          ${ICONS.card.replace("premium-benefit__icon", "premium-modal__title-icon")}
          <span class="premium-modal__title">Оплата: ${plan.label}</span>
        </h2>
        <p class="premium-modal__checkout-sum">К оплате: <strong>${formatRub(plan.price)}</strong></p>
        <ol class="premium-modal__steps">
          <li>Нажмите «Перейти к оплате» и переведите указанную сумму.</li>
          <li>В комментарии к платежу укажите: <code class="premium-modal__code">${esc(paymentComment)}</code>
            <button type="button" class="btn btn--small premium-modal__copy">${ICONS.copy} Скопировать</button>
          </li>
          <li>Мы активируем Премиум на аккаунт <strong>${esc(nick)}</strong> в течение 24 часов.</li>
        </ol>
        <div class="premium-modal__checkout-actions">
          <button type="button" class="btn btn--amber premium-modal__pay">${ICONS.pay} Перейти к оплате</button>
          <button type="button" class="btn premium-modal__back-btn">Назад</button>
        </div>
        <p id="premiumPayError" class="form-error hidden"></p>
      </div>`;
  }

  function renderGuest() {
    const plansHtml = PLANS.map(planCardHtml).join("");
    const next = encodeURIComponent(location.pathname + location.search);
    return `
      <div class="premium-modal__card panel" role="dialog" aria-modal="true" aria-labelledby="premiumModalTitle">
        <button type="button" class="premium-modal__close" aria-label="Закрыть">×</button>
        <p class="premium-modal__badge">${ICONS.crown} Премиум</p>
        <h2 id="premiumModalTitle" class="premium-modal__title-row">
          ${ICONS.crown.replace("premium-benefit__icon", "premium-modal__title-icon")}
          <span class="premium-modal__title">Подписка Премиум</span>
        </h2>
        <ul class="premium-modal__benefits">
          ${benefitsHtml()}
        </ul>
        <p class="premium-modal__plans-title">Тарифы</p>
        <div class="premium-modal__plans">${plansHtml}</div>
        <p class="premium-modal__guest">Войдите, чтобы оформить подписку на свой аккаунт.</p>
        <div class="premium-modal__checkout-actions">
          <a href="${BunkerAuth.pageUrl(`auth.html?tab=login&next=${next}`)}" class="btn btn--amber">Войти</a>
          <a href="${BunkerAuth.pageUrl(`auth.html?tab=register&next=${next}`)}" class="btn">Регистрация</a>
        </div>
      </div>`;
  }

  function bindGuestHandlers() {
    overlay.querySelector(".premium-modal__close")?.addEventListener("click", close);
    overlay.querySelectorAll("[data-plan-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = encodeURIComponent(location.pathname + location.search);
        location.href = BunkerAuth.pageUrl(`auth.html?tab=login&next=${next}`);
      });
    });
  }

  function bindMainHandlers() {
    overlay.querySelector(".premium-modal__close")?.addEventListener("click", close);
    overlay.querySelectorAll("[data-plan-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const plan = PLANS.find((p) => p.id === btn.dataset.planId);
        if (!plan) return;
        if (!currentUser) {
          location.href = BunkerAuth.pageUrl(
            `auth.html?tab=login&next=${encodeURIComponent(location.pathname + location.search)}`
          );
          return;
        }
        selectedPlan = plan;
        showCheckout();
      });
    });
  }

  function bindCheckoutHandlers() {
    overlay.querySelector(".premium-modal__close")?.addEventListener("click", close);
    overlay.querySelectorAll(".premium-modal__back, .premium-modal__back-btn").forEach((el) => {
      el.addEventListener("click", () => {
        selectedPlan = null;
        renderMainView();
      });
    });
    const paymentComment = `Премиум ${selectedPlan.label} — ${currentUser?.nickname || ""}`;
    overlay.querySelector(".premium-modal__copy")?.addEventListener("click", async (e) => {
      const text = paymentComment;
      try {
        await navigator.clipboard.writeText(text);
        e.currentTarget.textContent = "Скопировано";
        setTimeout(() => {
          e.currentTarget.textContent = "Скопировать";
        }, 2000);
      } catch {
        window.prompt("Скопируйте комментарий:", text);
      }
    });
    overlay.querySelector(".premium-modal__pay")?.addEventListener("click", () => {
      openPayment(selectedPlan);
    });
  }

  function renderMainView() {
    overlay.innerHTML = renderMain();
    bindMainHandlers();
  }

  function showCheckout() {
    overlay.innerHTML = renderCheckout(selectedPlan);
    bindCheckoutHandlers();
  }

  function loadCloudTipsBundle() {
    return new Promise((resolve, reject) => {
      if (window.ctips?.CloudTipsSiteWidget) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-bunker="cloudtips"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("cloudtips")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://widget.cloudtips.ru/bundle.js";
      script.defer = true;
      script.dataset.bunker = "cloudtips";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("cloudtips"));
      document.head.appendChild(script);
    });
  }

  function openPayment(plan) {
    const cfg = window.BUNKER_CONFIG || {};
    const url = (cfg.donateUrl || "").trim();
    const layoutId = (cfg.donateCloudTipsLayoutId || "").trim();
    const errEl = overlay.querySelector("#premiumPayError");

    function showErr(msg) {
      if (!errEl) {
        window.alert(msg);
        return;
      }
      errEl.textContent = msg;
      errEl.classList.remove("hidden");
    }

    if (!url && !layoutId) {
      showErr("Оплата не настроена. Укажите donateUrl в config.js.");
      return;
    }

    if (layoutId) {
      loadCloudTipsBundle()
        .then(() => {
          const widget = new ctips.CloudTipsSiteWidget();
          widget.open({ layoutid: layoutId });
        })
        .catch(() => {
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
          } else {
            showErr("Не удалось открыть форму оплаты.");
          }
        });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function close() {
    overlay?.classList.add("hidden");
    selectedPlan = null;
  }

  async function open(user) {
    const el = ensureOverlay();
    el.classList.remove("hidden");

    if (user !== undefined) {
      currentUser = user;
    } else if (window.BunkerAuth?.apiBase()) {
      currentUser = await BunkerAuth.fetchMe();
    } else {
      currentUser = null;
    }

    if (!currentUser && window.BunkerAuth?.apiBase()) {
      el.innerHTML = renderGuest();
      bindGuestHandlers();
      return;
    }

    renderMainView();
  }

  window.BunkerPremiumModal = { open, close, PLANS, BENEFITS };
})();
