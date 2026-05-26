const authSection = document.getElementById("authSection");
const accountTagline = document.getElementById("accountTagline");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const registerSuccess = document.getElementById("registerSuccess");
const resetError = document.getElementById("resetError");
const resetSuccess = document.getElementById("resetSuccess");
const sendRegCodeBtn = document.getElementById("sendRegCodeBtn");
const sendResetCodeBtn = document.getElementById("sendResetCodeBtn");

function showMessage(el, msg) {
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function getTurnstileSiteKey() {
  return (window.BUNKER_CONFIG?.turnstileSiteKey || "").trim();
}

const captchaState = {
  login: "",
  register: "",
  reset: "",
};

function ensureCaptcha(tabName) {
  if (!getTurnstileSiteKey()) return "";
  const token = captchaState[tabName] || "";
  if (!token) throw new Error("Подтвердите, что вы не робот.");
  return token;
}

function resetCaptcha(tabName) {
  captchaState[tabName] = "";
  if (!window.turnstile || !window.__bunkerTurnstileIds) return;
  const id = window.__bunkerTurnstileIds[tabName];
  if (id) window.turnstile.reset(id);
}

function renderTurnstile() {
  const siteKey = getTurnstileSiteKey();
  if (!siteKey || !window.turnstile) return;
  window.__bunkerTurnstileIds = window.__bunkerTurnstileIds || {};
  [
    ["login", "loginCaptcha"],
    ["register", "registerCaptcha"],
    ["reset", "resetCaptcha"],
  ].forEach(([name, id]) => {
    const el = document.getElementById(id);
    if (!el || window.__bunkerTurnstileIds[name]) return;
    window.__bunkerTurnstileIds[name] = window.turnstile.render(el, {
      sitekey: siteKey,
      callback: (token) => {
        captchaState[name] = token || "";
      },
      "expired-callback": () => {
        captchaState[name] = "";
      },
      "error-callback": () => {
        captchaState[name] = "";
      },
    });
  });
}

function switchTab(tab) {
  document.querySelectorAll(".auth-tabs__btn").forEach((b) => {
    b.classList.toggle("auth-tabs__btn--active", b.dataset.tab === tab);
  });
  loginForm.classList.toggle("hidden", tab !== "login");
  registerForm.classList.toggle("hidden", tab !== "register");
  resetForm.classList.toggle("hidden", tab !== "reset");
  showMessage(loginError, "");
  showMessage(registerError, "");
  showMessage(registerSuccess, "");
  showMessage(resetError, "");
  showMessage(resetSuccess, "");
}

document.querySelectorAll(".auth-tabs__btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(loginError, "");
  try {
    const captchaToken = ensureCaptcha("login");
    const user = await BunkerAuth.login(
      document.getElementById("loginNickname").value,
      document.getElementById("loginPassword").value,
      { captchaToken }
    );
    const next = new URLSearchParams(location.search).get("next");
    location.href = next || BunkerAuth.profileUrl(user);
  } catch (err) {
    showMessage(loginError, err.message);
    resetCaptcha("login");
  }
});

sendRegCodeBtn.addEventListener("click", async () => {
  showMessage(registerError, "");
  showMessage(registerSuccess, "");
  const email = document.getElementById("regEmail").value.trim();
  if (!email) {
    showMessage(registerError, "Введите email.");
    return;
  }
  try {
    sendRegCodeBtn.disabled = true;
    const captchaToken = ensureCaptcha("register");
    await BunkerAuth.requestEmailCode(email, "register", captchaToken);
    showMessage(registerSuccess, "Код отправлен на почту.");
  } catch (err) {
    showMessage(registerError, err.message);
    resetCaptcha("register");
  } finally {
    sendRegCodeBtn.disabled = false;
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(registerError, "");
  showMessage(registerSuccess, "");
  const p1 = document.getElementById("regPassword").value;
  const p2 = document.getElementById("regPassword2").value;
  if (p1 !== p2) {
    showMessage(registerError, "Пароли не совпадают.");
    return;
  }
  try {
    const captchaToken = ensureCaptcha("register");
    const user = await BunkerAuth.register(
      document.getElementById("regNickname").value,
      p1,
      {
        email: document.getElementById("regEmail").value.trim(),
        verificationCode: document.getElementById("regCode").value.trim(),
        captchaToken,
      }
    );
    location.href = BunkerAuth.profileUrl(user);
  } catch (err) {
    showMessage(registerError, err.message);
    resetCaptcha("register");
  }
});

sendResetCodeBtn.addEventListener("click", async () => {
  showMessage(resetError, "");
  showMessage(resetSuccess, "");
  const email = document.getElementById("resetEmail").value.trim();
  if (!email) {
    showMessage(resetError, "Введите email.");
    return;
  }
  try {
    sendResetCodeBtn.disabled = true;
    const captchaToken = ensureCaptcha("reset");
    await BunkerAuth.requestPasswordReset(email, captchaToken);
    showMessage(resetSuccess, "Код для сброса отправлен на почту.");
  } catch (err) {
    showMessage(resetError, err.message);
    resetCaptcha("reset");
  } finally {
    sendResetCodeBtn.disabled = false;
  }
});

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(resetError, "");
  showMessage(resetSuccess, "");
  try {
    const captchaToken = ensureCaptcha("reset");
    await BunkerAuth.resetPassword(
      document.getElementById("resetEmail").value.trim(),
      document.getElementById("resetCode").value.trim(),
      document.getElementById("resetPassword").value,
      captchaToken
    );
    showMessage(resetSuccess, "Пароль обновлён. Теперь войдите в аккаунт.");
    switchTab("login");
  } catch (err) {
    showMessage(resetError, err.message);
    resetCaptcha("reset");
  }
});

(function applyTabFromUrl() {
  const tab = new URLSearchParams(location.search).get("tab");
  if (tab === "register" || tab === "reset" || tab === "login") {
    switchTab(tab);
  }
})();

(async function init() {
  if (!BunkerAuth.apiBase()) {
    accountTagline.textContent = "Для авторизации нужен сервер: укажите apiUrl в config.js.";
    return;
  }
  if (!getTurnstileSiteKey()) {
    accountTagline.textContent = "Укажите turnstileSiteKey в config.js для включения Cloudflare Turnstile.";
  }
  const user = await BunkerAuth.fetchMe();
  if (user) {
    location.href = BunkerAuth.profileUrl(user);
    return;
  }
  authSection.classList.remove("hidden");
})();

window.addEventListener("load", () => {
  renderTurnstile();
  if (!window.turnstile) {
    const timer = setInterval(() => {
      if (!window.turnstile) return;
      clearInterval(timer);
      renderTurnstile();
    }, 150);
    setTimeout(() => clearInterval(timer), 6000);
  }
});
