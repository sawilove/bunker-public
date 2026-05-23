function formatYearsLabel(years) {
  const n = Math.abs(Math.floor(years));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} года`;
  return `${n} лет`;
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
  bg.style.setProperty("--scenario-bg-image", `url(/scenarios/${data.scene}.png)`);
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
      <p class="scenario-hero__text">${scenarioEscape(data.text || "Катастрофа будет выбрана при старте игры.")}</p>`;
    return;
  }

  const years = data.yearsLabel
    ? data.yearsLabel
    : data.yearsInBunker
      ? formatYearsLabel(data.yearsInBunker)
      : null;
  const yearsLine = years
    ? `<p class="scenario-hero__years">В бункере: <strong>${scenarioEscape(years)}</strong></p>`
    : "";
  const spotsLine =
    options.showSpots && data.spotsText
      ? `<p class="scenario-hero__spots">${scenarioEscape(data.spotsText)}</p>`
      : "";

  heroEl.classList.remove("hidden");
  heroEl.innerHTML = `
    <p class="scenario-hero__badge">Сценарий катастрофы</p>
    <h2 class="scenario-hero__title">${scenarioEscape(data.title)}</h2>
    ${yearsLine}
    <p class="scenario-hero__text">${scenarioEscape(data.text)}</p>
    ${spotsLine}`;
}

function enrichScenarioFromCatalog(story) {
  if (!story) return null;
  return {
    ...story,
    yearsLabel: story.yearsLabel || formatYearsLabel(story.yearsInBunker),
  };
}
