/** Ensures relative assets resolve from site root on clean URL routes. */
(function () {
  const path = location.pathname.replace(/\\/g, "/");
  const needsRoot =
    /^\/user\/[^/]+\/?$/i.test(path) ||
    /^\/(?:account|auth|news|friends|achievements|leaderboard|host|player|profile|game\/[^/]+)\/?$/i.test(path);
  if (!needsRoot || document.querySelector("base[data-bunker-root]")) return;
  const base = document.createElement("base");
  base.href = "/";
  base.setAttribute("data-bunker-root", "1");
  document.head.appendChild(base);
})();
