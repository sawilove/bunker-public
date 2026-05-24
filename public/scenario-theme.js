function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function formatYearsLabel(years) {
  if (typeof years === "string") return years;
  const n = Math.abs(Math.floor(years));
  return `${n} ${pluralRu(n, "год", "года", "лет")}`;
}

function formatDurationLabel(years, months) {
  if (typeof years === "string") return years;
  const y = Math.max(0, Math.floor(years || 0));
  const m = Math.max(0, Math.floor(months || 0));
  const parts = [];
  if (y > 0) parts.push(`${y} ${pluralRu(y, "год", "года", "лет")}`);
  if (m > 0) parts.push(`${m} ${pluralRu(m, "месяц", "месяца", "месяцев")}`);
  return parts.length ? parts.join(" ") : "менее месяца";
}

function scenarioEscape(str) {
  const el = document.createElement("div");
  el.textContent = str;
  return el.innerHTML;
}

function clearScenarioBackground() {
  document.body.classList.remove("has-scenario-bg");
  const bg = document.getElementById("scenarioBg");
  if (bg) bg.style.removeProperty("--scenario-bg-image");
}

function applyScenarioBackground(data) {
  if (!data || data.isRandom || !data.scene) {
    clearScenarioBackground();
    return;
  }
  const bg = document.getElementById("scenarioBg");
  if (!bg) return;
  document.body.classList.add("has-scenario-bg");
  const img = window.BunkerRuntime
    ? BunkerRuntime.assetUrl(`scenarios/${data.scene}.png`)
    : `/scenarios/${data.scene}.png`;
  bg.style.setProperty("--scenario-bg-image", `url(${img})`);
}

function renderScenarioHero(heroEl, data, options = {}) {
  if (!heroEl) return;

  if (!data) {
    heroEl.classList.add("hidden");
    heroEl.innerHTML = "";
    return;
  }

  if (data.isRandom) {
    heroEl.classList.remove("hidden");
    heroEl.innerHTML = `
      <p class="scenario-hero__badge">Сценарий</p>
      <h2 class="scenario-hero__title">${scenarioEscape(data.title || "Случайный сценарий")}</h2>
      ${options.hideText ? "" : `<p class="scenario-hero__text">${scenarioEscape(data.text || "Катастрофа будет выбрана при старте игры.")}</p>`}`;
    return;
  }

  const loc = data.locationLabel || "В бункере";
  const stayLabel =
    data.stayDurationLabel ||
    data.yearsLabel ||
    (data.stayDuration
      ? formatDurationLabel(data.stayDuration.years, data.stayDuration.months)
      : data.yearsInBunker
        ? formatYearsLabel(data.yearsInBunker)
        : null);

  const yearsLine = stayLabel
    ? `<p class="scenario-hero__years">${scenarioEscape(loc)}: <strong>${scenarioEscape(stayLabel)}</strong></p>`
    : data.bunkerParamsPending && data.bunkerParamsNote
      ? `<p class="scenario-hero__years scenario-hero__years--pending">${scenarioEscape(data.bunkerParamsNote)}</p>`
      : "";

  const bunkerStats = renderBunkerStats(data);
  const spotsLine =
    options.showSpots && data.spotsText
      ? `<p class="scenario-hero__spots">${scenarioEscape(data.spotsText)}</p>`
      : "";
  const badge = data.badge || "Сценарий катастрофы";

  heroEl.classList.remove("hidden");
  heroEl.innerHTML = `
    <p class="scenario-hero__badge">${scenarioEscape(badge)}</p>
    <h2 class="scenario-hero__title">${scenarioEscape(data.title)}</h2>
    ${yearsLine}
    ${bunkerStats}
    ${options.hideText ? "" : `<p class="scenario-hero__text">${scenarioEscape(data.text)}</p>`}
    ${spotsLine}`;
}

function renderBunkerStats(data) {
  if (data.bunkerParamsPending || !data.bunkerType) return "";

  const rows = [
    ["Тип убежища", data.bunkerType],
    ["Состояние", data.bunkerCondition],
    ["Площадь", data.bunkerArea],
    ["Внутри", data.bunkerInventory],
  ];

  if (data.foodSupplyLabel) {
    rows.push(["Запас еды", data.foodSupplyLabel]);
  }

  const items = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<div class="scenario-hero__stat"><dt>${scenarioEscape(label)}</dt><dd>${scenarioEscape(value)}</dd></div>`
    )
    .join("");

  if (!items) return "";

  return `<dl class="scenario-hero__bunker-stats">${items}</dl>`;
}

function enrichScenarioFromCatalog(story) {
  if (!story) return null;
  return {
    ...story,
    bunkerParamsPending: true,
    bunkerParamsNote:
      story.bunkerParamsNote ||
      "Срок пребывания, запасы и описание бункера определятся случайно при старте игры.",
    badge: story.badge,
    locationLabel: story.locationLabel,
  };
}
