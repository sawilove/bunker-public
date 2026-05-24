(function () {
  const cfg = window.BUNKER_CONFIG || {};
  const btn = document.getElementById("donateBtn");
  if (!btn) return;

  const url = (cfg.donateUrl || "").trim();
  const layoutId = (cfg.donateCloudTipsLayoutId || "").trim();

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

  function openCloudTips() {
    const widget = new ctips.CloudTipsSiteWidget();
    widget.open({ layoutid: layoutId });
  }

  if (!url && !layoutId) {
    btn.classList.add("authors-footer__donate--disabled");
    btn.setAttribute("aria-disabled", "true");
    btn.title = "Укажите donateUrl или donateCloudTipsLayoutId в config.js";
    btn.addEventListener("click", (e) => e.preventDefault());
    return;
  }

  btn.addEventListener("click", (e) => {
    if (!layoutId) return;

    e.preventDefault();
    loadCloudTipsBundle()
      .then(openCloudTips)
      .catch(() => {
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }
        window.alert("Не удалось открыть форму оплаты. Проверьте подключение к интернету.");
      });
  });

  if (url) {
    btn.href = url;
    if (!layoutId) {
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
    }
  } else {
    btn.removeAttribute("href");
  }
})();
