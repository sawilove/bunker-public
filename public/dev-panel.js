(function () {
  let panel = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "dev-panel hidden";
    panel.innerHTML = `
      <div class="dev-panel__card panel" role="dialog" aria-modal="true">
        <button type="button" class="dev-panel__close" aria-label="Закрыть">×</button>
        <h2 class="dev-panel__title">Служебные настройки</h2>
        <p class="dev-panel__hint">Только для аккаунтов с флагом dev в базе данных.</p>
        <label class="dev-panel__row">
          <input type="checkbox" id="devMaintenanceToggle">
          <span>Режим технического обслуживания</span>
        </label>
        <p class="dev-panel__note">При включении все пользователи без dev увидят страницу техработ на любом URL сайта.</p>
        <div class="dev-panel__actions">
          <button type="button" class="btn btn--small btn--amber" data-dev-catalog-scenarios>Редактировать сценарии</button>
          <button type="button" class="btn btn--small btn--amber" data-dev-catalog-pools>Паки характеристик</button>
        </div>
        <p id="devPanelError" class="form-error hidden"></p>
        <p id="devPanelSuccess" class="form-success hidden"></p>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector(".dev-panel__close").addEventListener("click", close);
    panel.addEventListener("click", (e) => {
      if (e.target === panel) close();
    });
    panel.querySelector("#devMaintenanceToggle").addEventListener("change", onMaintenanceToggle);
    panel.querySelector("[data-dev-catalog-scenarios]")?.addEventListener("click", () => {
      close();
      BunkerScenarioEditor?.openDevScenariosEditor?.();
    });
    panel.querySelector("[data-dev-catalog-pools]")?.addEventListener("click", () => {
      close();
      BunkerScenarioEditor?.openDevCardPoolsEditor?.();
    });
    return panel;
  }

  function close() {
    panel?.classList.add("hidden");
  }

  async function onMaintenanceToggle(e) {
    const errEl = panel.querySelector("#devPanelError");
    const okEl = panel.querySelector("#devPanelSuccess");
    errEl.classList.add("hidden");
    okEl.classList.add("hidden");
    const enabled = e.target.checked;
    try {
      await BunkerAuth.setMaintenance(enabled);
      okEl.textContent = enabled
        ? "Техобслуживание включено."
        : "Техобслуживание выключено.";
      okEl.classList.remove("hidden");
    } catch (err) {
      e.target.checked = !enabled;
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  }

  async function open() {
    const el = ensurePanel();
    el.classList.remove("hidden");
    const toggle = el.querySelector("#devMaintenanceToggle");
    try {
      const data = await BunkerAuth.getDevSettings();
      toggle.checked = !!data.maintenance;
    } catch (err) {
      const errEl = el.querySelector("#devPanelError");
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  }

  window.BunkerDevPanel = { open, close };
})();
