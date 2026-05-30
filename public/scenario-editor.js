(function () {
  const CUSTOM_ID = "custom";
  const GEAR_SVG = `<svg class="scenario-card__gear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  const LOCK_SVG = `<span class="scenario-card__lock" aria-hidden="true">🔒</span>`;

  let overlay = null;

  function esc(str) {
    return BunkerUserBadges.escapeHtml(str || "");
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "scenario-editor hidden";
    overlay.innerHTML = `<div class="scenario-editor__card panel" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    return overlay;
  }

  function close() {
    overlay?.classList.add("hidden");
  }

  function openModal(title, bodyHtml, onSave) {
    const el = ensureOverlay();
    const card = el.querySelector(".scenario-editor__card");
    card.innerHTML = `
      <button type="button" class="scenario-editor__close" aria-label="Закрыть">×</button>
      <h2 class="scenario-editor__title">${esc(title)}</h2>
      ${bodyHtml}
      <p class="form-error hidden" data-editor-error></p>
      <p class="form-success hidden" data-editor-success></p>
      <div class="scenario-editor__actions">
        <button type="button" class="btn btn--amber" data-editor-save>Сохранить</button>
        <button type="button" class="btn" data-editor-cancel>Отмена</button>
      </div>`;
    el.classList.remove("hidden");
    card.querySelector(".scenario-editor__close").addEventListener("click", close);
    card.querySelector("[data-editor-cancel]").addEventListener("click", close);
    card.querySelector("[data-editor-save]").addEventListener("click", async () => {
      const errEl = card.querySelector("[data-editor-error]");
      const okEl = card.querySelector("[data-editor-success]");
      errEl.classList.add("hidden");
      okEl.classList.add("hidden");
      try {
        await onSave(card, errEl, okEl);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
      }
    });
    return card;
  }

  async function openCustomScenarioEditor(initial, onSaved) {
    const scenes = ["scene0", "scene1", "scene2", "scene3", "scene4", "scene5", "scene6", "scene7", "scene8"];
    const sceneOpts = scenes
      .map(
        (s) =>
          `<option value="${s}" ${initial?.scene === s ? "selected" : ""}>${s}</option>`
      )
      .join("");
    const body = `
      <label class="field">
        <span class="field__label">Название катастрофы</span>
        <input type="text" data-custom-title maxlength="80" value="${esc(initial?.title || "")}">
      </label>
      <label class="field">
        <span class="field__label">Описание</span>
        <textarea data-custom-text rows="6" maxlength="4000">${esc(initial?.text || "")}</textarea>
      </label>
      <label class="field">
        <span class="field__label">Фон (опционально)</span>
        <select data-custom-scene>
          <option value="">Без картинки</option>
          ${sceneOpts}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Подпись срока / места</span>
        <input type="text" data-custom-location maxlength="80" value="${esc(initial?.locationLabel || "В бункере")}">
      </label>`;
    openModal("Своя катастрофа", body, async (card, errEl, okEl) => {
      const title = card.querySelector("[data-custom-title]").value.trim();
      const text = card.querySelector("[data-custom-text]").value.trim();
      const scene = card.querySelector("[data-custom-scene]").value || null;
      const locationLabel = card.querySelector("[data-custom-location]").value.trim() || "В бункере";
      if (!title || !text) {
        errEl.textContent = "Заполните название и описание.";
        errEl.classList.remove("hidden");
        return;
      }
      const data = await BunkerAuth.saveCustomScenario({ title, text, scene, locationLabel });
      okEl.textContent = "Сохранено.";
      okEl.classList.remove("hidden");
      onSaved?.(data.customBackstory);
      setTimeout(close, 600);
    });
  }

  function renderScenarioList(backstories, overrides) {
    return backstories
      .map((b) => {
        const o = overrides[b.id] || {};
        return `<details class="scenario-editor__story" open>
          <summary>${esc(b.title)} <code>${esc(b.id)}</code></summary>
          <label class="field"><span class="field__label">Название</span>
            <input type="text" data-story-id="${esc(b.id)}" data-story-field="title" maxlength="80" value="${esc(o.title ?? b.title)}"></label>
          <label class="field"><span class="field__label">Текст</span>
            <textarea data-story-id="${esc(b.id)}" data-story-field="text" rows="4" maxlength="4000">${esc(o.text ?? b.text)}</textarea></label>
        </details>`;
      })
      .join("");
  }

  function poolStorageKey(cardKey) {
    return cardKey === "gender_age" ? "gender" : cardKey;
  }

  function renderPoolEditors(cardTypes, pools, overrides) {
    const safeTypes = Array.isArray(cardTypes) ? cardTypes : [];
    const safePools = pools && typeof pools === "object" ? pools : {};
    const safeOverrides = overrides && typeof overrides === "object" ? overrides : {};
    return safeTypes
      .map(({ key, label }) => {
        const storageKey = poolStorageKey(key);
        const values =
          safeOverrides[storageKey] ||
          safeOverrides[key] ||
          safePools[storageKey] ||
          safePools[key] ||
          [];
        const lines = (Array.isArray(values) ? values : []).join("\n");
        return `<label class="field">
          <span class="field__label">${esc(label)} <code>${esc(key)}</code></span>
          <textarea data-pool-key="${esc(storageKey)}" rows="3" placeholder="Одно значение на строку">${esc(lines)}</textarea>
        </label>`;
      })
      .join("");
  }

  async function openDevScenariosEditor() {
    const data = await BunkerAuth.getDevGameCatalog();
    const body = `<p class="scenario-editor__hint">Изменения применяются ко всем новым сессиям на сервере.</p>
      <div class="scenario-editor__scroll">${renderScenarioList(data.backstories, data.backstoryOverrides || {})}</div>`;
    openModal("Редактор сценариев", body, async (card, errEl, okEl) => {
      const overrides = { ...(data.backstoryOverrides || {}) };
      card.querySelectorAll("[data-story-id]").forEach((el) => {
        const id = el.dataset.storyId;
        const field = el.dataset.storyField;
        if (!overrides[id]) overrides[id] = {};
        overrides[id][field] = el.value;
      });
      const base = data.backstories.find((b) => b.id && overrides[b.id]);
      for (const b of data.backstories) {
        const o = overrides[b.id];
        if (!o) continue;
        const sameTitle = (o.title ?? b.title) === b.title;
        const sameText = (o.text ?? b.text) === b.text;
        if (sameTitle && sameText && !o.scene && !o.locationLabel) delete overrides[b.id];
      }
      await BunkerAuth.saveDevGameCatalog({ backstoryOverrides: overrides });
      okEl.textContent = "Сценарии сохранены.";
      okEl.classList.remove("hidden");
      setTimeout(() => {
        close();
        const dest =
          window.BunkerRuntime?.pageUrl?.("index.html") ||
          location.pathname.replace(/\/[^/]*$/, "/") ||
          "/";
        window.location.replace(dest.startsWith("http") ? dest : `${location.origin}${dest}`);
      }, 500);
    });
  }

  async function openDevCardPoolsEditor() {
    const data = await BunkerAuth.getDevGameCatalog();
    const body = `<p class="scenario-editor__hint">Пустое поле = стандартный пак. Одно значение на строку.</p>
      <div class="scenario-editor__scroll">${renderPoolEditors(data.cardTypes, data.cardPools, data.cardPoolOverrides || {})}</div>`;
    openModal("Паки характеристик", body, async (card, errEl, okEl) => {
      const cardPoolOverrides = {};
      card.querySelectorAll("[data-pool-key]").forEach((el) => {
        const key = el.dataset.poolKey;
        const values = el.value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (values.length) cardPoolOverrides[key] = values;
      });
      await BunkerAuth.saveDevGameCatalog({ cardPoolOverrides });
      okEl.textContent = "Паки сохранены.";
      okEl.classList.remove("hidden");
      setTimeout(close, 600);
    });
  }

  function customScenarioCardHtml(canUse) {
    const locked = canUse ? "" : " scenario-card--locked";
    const lockMark = canUse ? GEAR_SVG : LOCK_SVG;
    return `<button type="button" class="scenario-card scenario-card--custom${locked}" data-id="${CUSTOM_ID}" aria-selected="false" title="Своя катастрофа">
      <span class="scenario-card__custom-mark">${lockMark}</span>
      <span class="scenario-card__label">Своя катастрофа</span>
    </button>`;
  }

  window.BunkerScenarioEditor = {
    CUSTOM_ID,
    close,
    openCustomScenarioEditor,
    openDevScenariosEditor,
    openDevCardPoolsEditor,
    customScenarioCardHtml,
  };
})();
