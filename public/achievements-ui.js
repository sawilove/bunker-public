(function () {
  function assetUrl(path) {
    if (!path) return "";
    if (window.BunkerAuth?.assetUrl) return BunkerAuth.assetUrl(path);
    if (window.BunkerRuntime) return BunkerRuntime.assetUrl(path.replace(/^\//, ""));
    return path;
  }

  function shineClass(ach, locked) {
    if (locked) return "";
    if (ach.type === "unique") return " achievement-medal--shine achievement-medal--shine-unique";
    if (ach.tier === "platinum") return " achievement-medal--shine achievement-medal--shine-platinum";
    return "";
  }

  function medalHtml(ach, opts = {}) {
    if (!ach) return "";
    const esc = window.BunkerUserBadges?.escapeHtml || ((s) => String(s));
    const size = opts.size || "md";
    const locked = opts.locked;
    const name = ach.name || "";
    const icon = assetUrl(ach.iconUrl || ach.icon || "");
    const titleAttr = opts.showTitle !== false ? ` title="${esc(name)}"` : "";
    const lockedClass = locked ? " achievement-medal--locked" : "";
    const selectedClass = opts.selected ? " achievement-medal--selected" : "";
    const displayedClass = opts.displayed ? " achievement-medal--displayed" : "";
    const interactiveClass = opts.interactive ? " achievement-medal--interactive" : "";
    const shine = shineClass(ach, locked);
    return `<span class="achievement-medal achievement-medal--${size}${lockedClass}${selectedClass}${displayedClass}${interactiveClass}${shine}"${titleAttr} data-achievement-id="${esc(ach.id || "")}">
      <img class="achievement-medal__img" src="${esc(icon)}" alt="" loading="lazy">
    </span>`;
  }

  function medalsRowHtml(achievements, opts = {}) {
    if (!achievements?.length) return "";
    return `<div class="achievement-medals${opts.className ? ` ${opts.className}` : ""}">${achievements.map((a) => medalHtml(a, opts)).join("")}</div>`;
  }

  function progressBarHtml(progress) {
    if (!progress) return "";
    const pct = Math.round((progress.current / progress.target) * 100);
    const esc = window.BunkerUserBadges?.escapeHtml || ((s) => String(s));
    return `<div class="achievement-progress">
      <div class="achievement-progress__bar"><div class="achievement-progress__fill" style="width:${pct}%"></div></div>
      <span class="achievement-progress__text">${esc(String(progress.current))} / ${esc(String(progress.target))}</span>
    </div>`;
  }

  function cardHtml(ach, opts = {}) {
    const esc = window.BunkerUserBadges?.escapeHtml || ((s) => String(s));
    const locked = !ach.unlocked;
    const typeLabels = { once: "Разовое", unique: "Уникальное", goal: "Целевое" };
    const typeLabel = typeLabels[ach.type] || ach.type;
    const cardShine = !locked && (ach.type === "unique" || ach.tier === "platinum")
      ? ` achievement-card--shine achievement-card--shine-${ach.type === "unique" ? "unique" : "platinum"}`
      : "";
    return `<article class="achievement-card${locked ? " achievement-card--locked" : ""}${cardShine}" data-achievement-id="${esc(ach.id)}">
      ${medalHtml(ach, { size: "lg", locked, showTitle: false })}
      <div class="achievement-card__body">
        <span class="achievement-card__type">${esc(typeLabel)}</span>
        <h3 class="achievement-card__name">${esc(ach.name)}</h3>
        <p class="achievement-card__desc">${esc(ach.description)}</p>
        ${ach.type === "goal" && !ach.unlocked && ach.progress ? progressBarHtml(ach.progress) : ""}
        ${ach.unlocked ? `<span class="achievement-card__status achievement-card__status--done">Получено</span>` : `<span class="achievement-card__status">Не получено</span>`}
      </div>
    </article>`;
  }

  window.BunkerAchievementsUi = {
    assetUrl,
    medalHtml,
    medalsRowHtml,
    progressBarHtml,
    cardHtml,
  };
})();
