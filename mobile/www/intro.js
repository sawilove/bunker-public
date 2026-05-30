(function () {
  "use strict";

  const cfg = window.BUNKER_MOBILE_CONFIG || {};
  const LOGO_MS = cfg.logoDuration ?? 2200;
  const TITLE_MS = cfg.titleDuration ?? 2400;
  const APP_URL = cfg.appUrl || "https://bunker-public.onrender.com/";

  const intro = document.getElementById("intro");
  const screenLogo = document.getElementById("screenLogo");
  const screenTitle = document.getElementById("screenTitle");
  const progress = document.getElementById("introProgress");

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function switchScreen(from, to) {
    from.classList.remove("is-active");
    from.classList.add("is-leaving");
    to.classList.add("is-active");
    return wait(650).then(function () {
      from.classList.remove("is-leaving");
    });
  }

  function runProgress(totalMs) {
    if (!progress) return;
    progress.style.transitionDuration = totalMs + "ms";
    requestAnimationFrame(function () {
      progress.style.width = "100%";
    });
  }

  function plugin(name) {
    return window.Capacitor?.Plugins?.[name] || null;
  }

  async function initNative() {
    if (!window.Capacitor?.isNativePlatform?.()) return;

    const SplashScreen = plugin("SplashScreen");
    const StatusBar = plugin("StatusBar");
    const App = plugin("App");

    if (SplashScreen?.hide) {
      await SplashScreen.hide();
    }
    if (StatusBar?.setStyle) {
      await StatusBar.setStyle({ style: "DARK" });
    }
    if (StatusBar?.setBackgroundColor) {
      await StatusBar.setBackgroundColor({ color: "#0a0c0a" });
    }
    if (App?.addListener) {
      App.addListener("backButton", function (ev) {
        if (ev.canGoBack) {
          window.history.back();
        } else if (App.exitApp) {
          App.exitApp();
        }
      });
    }
  }

  async function goToApp() {
    intro.classList.add("is-done");
    await wait(500);
    const base = APP_URL.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/api/auth/me`, { credentials: "include" });
      if (res.status >= 502) throw new Error("server unavailable");
    } catch {
      showServerError();
      return;
    }
    window.location.replace(APP_URL);
  }

  function showServerError() {
    intro.classList.remove("is-done");
    screenTitle.classList.remove("is-active");
    screenLogo.classList.remove("is-leaving");
    screenLogo.classList.add("is-active");
    if (progress) progress.style.width = "0%";

    let err = document.getElementById("introServerError");
    if (!err) {
      err = document.createElement("div");
      err.id = "introServerError";
      err.className = "intro__server-error";
      err.innerHTML =
        '<p class="intro__server-error-text">Сервер временно недоступен.</p>' +
        '<button type="button" class="intro__server-error-retry">Повторить</button>';
      intro.appendChild(err);
      err.querySelector(".intro__server-error-retry").addEventListener("click", function () {
        err.classList.add("hidden");
        goToApp();
      });
    }
    err.classList.remove("hidden");
  }

  async function runIntro() {
    await initNative();

    const totalMs = LOGO_MS + 650 + TITLE_MS;
    runProgress(totalMs);

    await wait(LOGO_MS);
    await switchScreen(screenLogo, screenTitle);
    await wait(TITLE_MS);
    await goToApp();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runIntro);
  } else {
    runIntro();
  }
})();
