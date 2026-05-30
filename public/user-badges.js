(function () {
  const STATUS_LABELS = {
    offline: "Не в сети",
    online: "В сети",
    in_game: "В игре",
    looking_for_game: "Ищет игру",
  };

  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str || "";
    return el.innerHTML;
  }

  function roleBadgesHtml(user) {
    const parts = [];
    if (user?.dev) {
      parts.push(
        '<span class="user-badge user-badge--dev" title="Разработчик">&lt;/&gt; Разработчик</span>'
      );
    }
    if (user?.premium) {
      parts.push(
        '<span class="user-badge user-badge--premium" title="Премиум">♛ Премиум</span>'
      );
    }
    return parts.join("");
  }

  function statusHtml(user) {
    let status = user?.status || "offline";
    if (user?.lookingForGame && status !== "offline") status = "looking_for_game";
    return `<span class="user-status user-status--${status}">${STATUS_LABELS[status] || STATUS_LABELS.offline}</span>`;
  }

  function frameClass(user) {
    if (user?.dev) return "user-frame--dev";
    if (user?.premium) return "user-frame--premium";
    return "";
  }

  function renderUserChip(user, opts = {}) {
    const av = window.BunkerAuth
      ? BunkerAuth.assetUrl(user?.avatarUrl || "/icons/default-avatar.svg")
      : user?.avatarUrl || "icons/default-avatar.svg";
    const frame = frameClass(user);
    const extraClass = opts.className ? ` ${opts.className}` : "";
    const tag = opts.href ? "a" : "div";
    const href = opts.href ? ` href="${opts.href}"` : "";
    return `
      <${tag} class="user-chip ${frame}${extraClass}"${href}>
        <img class="user-chip__avatar" src="${av}" alt="">
        <span class="user-chip__meta">
          <span class="user-chip__name">${escapeHtml(user?.nickname || "Игрок")}</span>
          ${opts.showBadges ? `<span class="user-chip__badges">${roleBadgesHtml(user)}</span>` : ""}
        </span>
      </${tag}>`;
  }

  window.BunkerUserBadges = {
    STATUS_LABELS,
    roleBadgesHtml,
    statusHtml,
    frameClass,
    renderUserChip,
    escapeHtml,
  };
})();
