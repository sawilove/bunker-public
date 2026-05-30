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

  const SCENE_KEYS = [
    "scene0",
    "scene1",
    "scene2",
    "scene3",
    "scene4",
    "scene5",
    "scene6",
    "scene7",
    "scene8",
  ];

  function renderScenePicker(selected, coverPreviewUrl) {
    const tiles = SCENE_KEYS.map((s) => {
      const src = BunkerRuntime.assetUrl(`scenarios/${s}.png`);
      const sel = selected === s ? " scenario-editor__scene--selected" : "";
      return `<button type="button" class="scenario-editor__scene${sel}" data-scene-key="${s}" title="${s}">
        <img src="${src}" alt="" loading="lazy">
      </button>`;
    }).join("");
    const preview = coverPreviewUrl
      ? `<img class="scenario-editor__cover-preview" src="${esc(coverPreviewUrl)}" alt="">`
      : `<span class="scenario-editor__cover-placeholder">Превью обложки</span>`;
    return `
      <p class="scenario-editor__hint">Выберите фон карточки как у классических сценариев (4:3).</p>
      <div class="scenario-editor__scene-grid">${tiles}</div>
      <label class="field">
        <span class="field__label">Своя обложка (опционально)</span>
        <input type="file" accept="image/*" data-cover-file>
      </label>
      <div class="scenario-editor__cover-preview-wrap">${preview}</div>
      <input type="hidden" data-scene-selected value="${esc(selected || "")}">`;
  }

  function centerCrop43(imgW, imgH) {
    const target = 4 / 3;
    const ratio = imgW / imgH;
    if (ratio > target) {
      const w = (imgH * target) / imgW;
      return { x: (1 - w) / 2, y: 0, w, h: 1 };
    }
    const h = imgW / target / imgH;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }

  function bindScenePicker(card) {
    const hidden = card.querySelector("[data-scene-selected]");
    card.querySelectorAll(".scenario-editor__scene").forEach((btn) => {
      btn.addEventListener("click", () => {
        card.querySelectorAll(".scenario-editor__scene").forEach((b) => {
          b.classList.toggle("scenario-editor__scene--selected", b === btn);
        });
        if (hidden) hidden.value = btn.dataset.sceneKey;
      });
    });
    const fileInput = card.querySelector("[data-cover-file]");
    const previewWrap = card.querySelector(".scenario-editor__cover-preview-wrap");
    if (!fileInput || !previewWrap) return;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        card.dataset.coverDataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          card.dataset.coverCrop = JSON.stringify(centerCrop43(img.width, img.height));
          previewWrap.innerHTML = `<img class="scenario-editor__cover-preview" src="${reader.result}" alt="">`;
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPoolPresetSection(preset, cardTypes, pools, customPools) {
    const p = preset || "standard";
    const customBlock =
      p === "custom"
        ? `<div class="scenario-editor__scroll">${renderPoolEditors(
            cardTypes,
            pools,
            customPools || {}
          )}</div>`
        : "";
    return `
      <fieldset class="scenario-editor__presets">
        <legend class="field__label">Пак характеристик</legend>
        <label><input type="radio" name="poolPreset" value="standard" ${p === "standard" ? "checked" : ""}> Стандартный</label>
        <label><input type="radio" name="poolPreset" value="18plus" ${p === "18plus" ? "checked" : ""}> 18+</label>
        <label><input type="radio" name="poolPreset" value="custom" ${p === "custom" ? "checked" : ""}> Свой</label>
      </fieldset>
      <div data-custom-pools class="${p === "custom" ? "" : "hidden"}">${customBlock}</div>`;
  }

  function bindPoolPreset(card) {
    const wrap = card.querySelector("[data-custom-pools]");
    card.querySelectorAll('input[name="poolPreset"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        wrap?.classList.toggle("hidden", radio.value !== "custom");
      });
    });
  }

  function readPublishForm(card) {
    const title = card.querySelector("[data-pub-title]")?.value.trim();
    const text = card.querySelector("[data-pub-text]")?.value.trim();
    const locationLabel =
      card.querySelector("[data-pub-location]")?.value.trim() || "В бункере";
    const sceneKey = card.querySelector("[data-scene-selected]")?.value || null;
    const cardPoolPreset =
      card.querySelector('input[name="poolPreset"]:checked')?.value || "standard";
    let cardPoolCustom = null;
    if (cardPoolPreset === "custom") {
      cardPoolCustom = {};
      card.querySelectorAll("[data-pool-key]").forEach((el) => {
        const values = el.value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (values.length) cardPoolCustom[el.dataset.poolKey] = values;
      });
    }
    return { title, text, locationLabel, sceneKey, cardPoolPreset, cardPoolCustom };
  }

  async function openPublishCatalogEditor(initial) {
    const catalog = await BunkerAuth.getDevGameCatalog().catch(() => ({
      cardTypes: [],
      cardPools: {},
    }));
    const body = `
      <p class="scenario-editor__hint">Черновик можно отправить на модерацию. После одобления dev сценарий появится в каталоге.</p>
      <label class="field"><span class="field__label">Название</span>
        <input type="text" data-pub-title maxlength="80" value="${esc(initial?.title || "")}"></label>
      <label class="field"><span class="field__label">Описание</span>
        <textarea data-pub-text rows="5" maxlength="4000">${esc(initial?.text || "")}</textarea></label>
      <label class="field"><span class="field__label">Подпись срока / места</span>
        <input type="text" data-pub-location maxlength="80" value="${esc(initial?.locationLabel || "В бункере")}"></label>
      ${renderScenePicker(initial?.sceneKey || initial?.scene, initial?.coverUrl ? BunkerAuth.scenarioCoverUrl(initial.coverUrl) : "")}
      ${renderPoolPresetSection(
        initial?.cardPoolPreset,
        catalog.cardTypes,
        catalog.cardPools,
        initial?.cardPoolCustom
      )}
      <input type="hidden" data-scenario-id value="${esc(initial?.catalogId || "")}">`;

    const el = ensureOverlay();
    const card = el.querySelector(".scenario-editor__card");
    card.innerHTML = `
      <button type="button" class="scenario-editor__close" aria-label="Закрыть">×</button>
      <h2 class="scenario-editor__title">Публикация в каталог</h2>
      ${body}
      <p class="form-error hidden" data-editor-error></p>
      <p class="form-success hidden" data-editor-success></p>
      <div class="scenario-editor__actions scenario-editor__actions--wrap">
        <button type="button" class="btn btn--amber" data-save-draft>Черновик</button>
        <button type="button" class="btn btn--amber" data-submit-mod>На модерацию</button>
        <button type="button" class="btn" data-editor-cancel>Отмена</button>
      </div>`;
    el.classList.remove("hidden");
    bindScenePicker(card);
    bindPoolPreset(card);
    card.querySelector(".scenario-editor__close").addEventListener("click", close);
    card.querySelector("[data-editor-cancel]").addEventListener("click", close);

    async function persist(submit) {
      const errEl = card.querySelector("[data-editor-error]");
      const okEl = card.querySelector("[data-editor-success]");
      errEl.classList.add("hidden");
      okEl.classList.add("hidden");
      const form = readPublishForm(card);
      if (!form.title || !form.text) {
        errEl.textContent = "Заполните название и описание.";
        errEl.classList.remove("hidden");
        return;
      }
      const id = card.querySelector("[data-scenario-id]").value || undefined;
      const { scenario } = await BunkerAuth.saveScenarioDraft({
        id,
        title: form.title,
        text: form.text,
        locationLabel: form.locationLabel,
        sceneKey: form.sceneKey,
        cardPoolPreset: form.cardPoolPreset,
        cardPoolCustom: form.cardPoolCustom,
      });
      card.querySelector("[data-scenario-id]").value = scenario.catalogId;
      if (card.dataset.coverDataUrl) {
        const crop = JSON.parse(card.dataset.coverCrop || "{}");
        await BunkerAuth.uploadScenarioCover(scenario.catalogId, card.dataset.coverDataUrl, crop);
      }
      if (submit) {
        await BunkerAuth.submitScenario(scenario.catalogId);
        okEl.textContent = "Отправлено на модерацию.";
      } else {
        okEl.textContent = "Черновик сохранён.";
      }
      okEl.classList.remove("hidden");
      setTimeout(close, 800);
    }

    card.querySelector("[data-save-draft]").addEventListener("click", () =>
      persist(false).catch((err) => {
        card.querySelector("[data-editor-error]").textContent = err.message;
        card.querySelector("[data-editor-error]").classList.remove("hidden");
      })
    );
    card.querySelector("[data-submit-mod]").addEventListener("click", () =>
      persist(true).catch((err) => {
        card.querySelector("[data-editor-error]").textContent = err.message;
        card.querySelector("[data-editor-error]").classList.remove("hidden");
      })
    );
  }

  const STATUS_LABELS = {
    draft: "Черновик",
    pending: "На модерации",
    published: "Опубликован",
    rejected: "Отклонён",
  };

  async function openMyScenarios() {
    const { scenarios } = await BunkerAuth.getMyScenarios();
    const rows = scenarios.length
      ? scenarios
          .map(
            (s) => `<li class="scenario-editor__mine-row">
              <strong>${esc(s.title)}</strong>
              <span class="scenario-editor__status scenario-editor__status--${esc(s.status)}">${esc(STATUS_LABELS[s.status] || s.status)}</span>
              ${s.reviewNote ? `<p class="scenario-editor__hint">${esc(s.reviewNote)}</p>` : ""}
              <button type="button" class="btn btn--small" data-edit-scenario="${esc(s.catalogId)}">Редактировать</button>
            </li>`
          )
          .join("")
      : "<p class=\"scenario-editor__hint\">У вас пока нет сценариев в каталоге.</p>";
    const body = `<ul class="scenario-editor__mine-list">${rows}</ul>
      <button type="button" class="btn btn--amber" data-new-catalog>Создать для каталога</button>`;
    const card = openModal("Мои сценарии", body, async () => {});
    card.querySelector("[data-editor-save]").classList.add("hidden");
    card.querySelector("[data-new-catalog]")?.addEventListener("click", () => {
      close();
      openPublishCatalogEditor(null);
    });
    card.querySelectorAll("[data-edit-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = scenarios.find((s) => s.catalogId === btn.dataset.editScenario);
        close();
        openPublishCatalogEditor(item || null);
      });
    });
  }

  async function openDevScenarioModeration() {
    const { scenarios } = await BunkerAuth.getDevPendingScenarios();
    const rows = scenarios.length
      ? scenarios
          .map(
            (s) => `<article class="scenario-editor__mod-row panel">
              <h3>${esc(s.title)} <small>@${esc(s.authorNickname || "?")}</small></h3>
              <p>${esc(s.text.slice(0, 200))}${s.text.length > 200 ? "…" : ""}</p>
              <label class="field"><span class="field__label">Комментарий</span>
                <input type="text" data-mod-note="${esc(s.catalogId)}" maxlength="500"></label>
              <div class="scenario-editor__actions">
                <button type="button" class="btn btn--amber btn--small" data-approve="${esc(s.catalogId)}">Одобрить</button>
                <button type="button" class="btn btn--danger btn--small" data-reject="${esc(s.catalogId)}">Отклонить</button>
              </div>
            </article>`
          )
          .join("")
      : "<p class=\"scenario-editor__hint\">Очередь модерации пуста.</p>";
    const card = openModal("Модерация сценариев", rows, async () => {});
    card.querySelector("[data-editor-save]").classList.add("hidden");
    card.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const note = card.querySelector(`[data-mod-note="${btn.dataset.approve}"]`)?.value;
        await BunkerAuth.approveScenario(btn.dataset.approve, note);
        close();
        openDevScenarioModeration();
      });
    });
    card.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const note = card.querySelector(`[data-mod-note="${btn.dataset.reject}"]`)?.value;
        await BunkerAuth.rejectScenario(btn.dataset.reject, note);
        close();
        openDevScenarioModeration();
      });
    });
  }

  async function openCustomScenarioEditor(initial, onSaved) {
    const scenes = SCENE_KEYS;
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
      </label>
      <button type="button" class="btn btn--small" data-open-publish-catalog>Опубликовать в каталог…</button>`;
    const card = openModal("Своя катастрофа", body, async (c, errEl, okEl) => {
      const title = c.querySelector("[data-custom-title]").value.trim();
      const text = c.querySelector("[data-custom-text]").value.trim();
      const scene = c.querySelector("[data-custom-scene]").value || null;
      const locationLabel = c.querySelector("[data-custom-location]").value.trim() || "В бункере";
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
    card.querySelector("[data-open-publish-catalog]")?.addEventListener("click", () => {
      const draft = {
        title: card.querySelector("[data-custom-title]").value.trim(),
        text: card.querySelector("[data-custom-text]").value.trim(),
        scene: card.querySelector("[data-custom-scene]").value || null,
        locationLabel: card.querySelector("[data-custom-location]").value.trim() || "В бункере",
      };
      close();
      openPublishCatalogEditor(draft);
    });
  }

  window.BunkerScenarioEditor = {
    CUSTOM_ID,
    close,
    openCustomScenarioEditor,
    openPublishCatalogEditor,
    openMyScenarios,
    openDevScenarioModeration,
    openDevScenariosEditor,
    openDevCardPoolsEditor,
    customScenarioCardHtml,
  };
})();
