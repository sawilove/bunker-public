/** Ensures relative assets resolve from site root on /user/:id, /account, etc. */
(function () {
  const path = location.pathname.replace(/\\/g, "/");
  const needsRoot =
    /^\/user\/[^/]+\/?$/i.test(path) ||
    path === "/account" ||
    path === "/news" ||
    path === "/friends" ||
    /^\/game\/[^/]+\/?$/i.test(path);
  if (!needsRoot || document.querySelector("base[data-bunker-root]")) return;
  const base = document.createElement("base");
  base.href = "/";
  base.setAttribute("data-bunker-root", "1");
  document.head.prepend(base);
})();
