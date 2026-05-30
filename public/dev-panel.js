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
          <button type="button" class="btn btn--small btn--amber" data-dev-scenario-mod>Модерация каталога</button>
          <button type="button" class="btn btn--small" data-dev-reports>Жалобы</button>
          <button type="button" class="btn btn--small" data-dev-payments>Платежи</button>
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
    panel.querySelector("[data-dev-scenario-mod]")?.addEventListener("click", () => {
      close();
      BunkerScenarioEditor?.openDevScenarioModeration?.();
    });
    panel.querySelector("[data-dev-reports]")?.addEventListener("click", openReportsModal);
    panel.querySelector("[data-dev-payments]")?.addEventListener("click", openPaymentsModal);
    return panel;
  }

  async function openReportsModal() {
    close();
    try {
      const data = await BunkerAuth.getDevReports();
      if (!data.reports?.length) {
        alert("Нет необработанных жалоб.");
        return;
      }
      const lines = data.reports
        .map(
          (r, i) =>
            `${i + 1}. ${r.target.nickname} ← ${r.reporter.nickname}\n   ${r.reason}: ${r.body.slice(0, 120)}`
        )
        .join("\n\n");
      const pick = window.prompt(
        `Жалобы (введите номер для закрытия или dismiss:N):\n\n${lines}`,
        "1"
      );
      if (!pick) return;
      const dismiss = /^dismiss:/i.test(pick);
      const num = parseInt(String(pick).replace(/^dismiss:/i, ""), 10);
      const report = data.reports[num - 1];
      if (!report) return;
      await BunkerAuth.resolveDevReport(report.id, dismiss);
      alert(dismiss ? "Жалоба отклонена." : "Жалоба обработана.");
    } catch (err) {
      alert(err.message);
    }
  }

  async function openPaymentsModal() {
    close();
    try {
      const data = await BunkerAuth.getDevPayments();
      const lines = (data.payments || [])
        .slice(0, 15)
        .map(
          (p) =>
            `${p.nickname}: ${p.planDays}д, ${p.amount}₽ (${p.source}) — ${new Date(p.createdAt).toLocaleString("ru-RU")}`
        )
        .join("\n");
      alert(lines || "Платежей пока нет.");
    } catch (err) {
      alert(err.message);
    }
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
