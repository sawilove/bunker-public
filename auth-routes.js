const path = require("path");
const sharp = require("sharp");
const { verifyTurnstile } = require("./turnstile");
const { issueEmailCode } = require("./email-auth");
const {
  register,
  login,
  resetPassword,
  verifyToken,
  publicUser,
  getUserByPublicId,
  updateProfile,
  setAvatarBuffer,
  getAvatarBuffer,
  setBannerBuffer,
  getBannerBuffer,
  canUseBanner,
  hasPremiumAccess,
  getCustomBackstory,
  setCustomBackstory,
} = require("./user-store");
const catalogRuntime = require("./catalog-runtime");
const { enrichPublicUser, getFriendship, listFriends } = require("./social-store");

const GUEST_AVATAR = "/icons/guest-avatar.svg";
const DEFAULT_AVATAR = "/icons/default-avatar.svg";

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, token) {
  if (!token) return;
  res.cookie("bunker_token", token, {
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}

function clearAuthCookie(res) {
  res.clearCookie("bunker_token", { path: "/" });
}

async function requireUser(req, res) {
  const user = await verifyToken(getBearerToken(req));
  if (!user) {
    res.status(401).json({ error: "Требуется вход в аккаунт." });
    return null;
  }
  return user;
}

async function requireCaptcha(req, res) {
  const token = req.body?.captchaToken;
  const ok = await verifyTurnstile(token, req.ip);
  if (!ok) {
    res.status(400).json({ error: "Подтвердите капчу." });
    return false;
  }
  return true;
}

function mountAuthRoutes(app) {
  const publicDir = path.join(__dirname, "public");

  app.get("/account", (req, res) => {
    res.redirect(302, "/auth");
  });

  app.get("/auth", (req, res) => {
    res.sendFile(path.join(publicDir, "auth.html"));
  });

  app.get("/profile", (req, res) => {
    res.sendFile(path.join(publicDir, "profile.html"));
  });

  app.get("/user/:userId", (req, res) => {
    res.sendFile(path.join(publicDir, "profile.html"));
  });

  app.get("/api/avatars/:userId", async (req, res) => {
    try {
      const buf = await getAvatarBuffer(req.params.userId);
      if (!buf) {
        res.status(404).end();
        return;
      }
      res.set("Cache-Control", "private, no-cache, must-revalidate");
      res.type("image/webp").send(buf);
    } catch (err) {
      console.error("avatar get error", err);
      res.status(500).end();
    }
  });

  app.get("/api/banners/:userId", async (req, res) => {
    try {
      const buf = await getBannerBuffer(req.params.userId);
      if (!buf) {
        res.status(404).end();
        return;
      }
      res.set("Cache-Control", "private, no-cache, must-revalidate");
      res.type("image/webp").send(buf);
    } catch (err) {
      console.error("banner get error", err);
      res.status(500).end();
    }
  });

  app.post("/api/auth/request-email-code", async (req, res) => {
    try {
      if (!(await requireCaptcha(req, res))) return;
      const { email, purpose } = req.body || {};
      const result = await issueEmailCode(email, purpose);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true, message: result.message });
    } catch (err) {
      console.error("request-email-code error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      if (!(await requireCaptcha(req, res))) return;
      const { email } = req.body || {};
      const result = await issueEmailCode(email, "reset");
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true, message: result.message });
    } catch (err) {
      console.error("request-password-reset error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      if (!(await requireCaptcha(req, res))) return;
      const { email, code, newPassword } = req.body || {};
      const result = await resetPassword({ email, code, newPassword });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true, message: result.message });
    } catch (err) {
      console.error("reset-password error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      if (!(await requireCaptcha(req, res))) return;
      const result = await register(req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      setAuthCookie(res, result.token);
      res.json({ user: result.user, token: result.token });
    } catch (err) {
      console.error("register error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      if (!(await requireCaptcha(req, res))) return;
      const result = await login(req.body || {});
      if (!result.ok) {
        res.status(401).json({ error: result.error });
        return;
      }
      setAuthCookie(res, result.token);
      res.json({ user: result.user, token: result.token });
    } catch (err) {
      console.error("login error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/users/:userId", async (req, res) => {
    try {
      const viewer = await verifyToken(getBearerToken(req));
      const user = await getUserByPublicId(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "Игрок не найден." });
        return;
      }
      const isSelf = viewer?.id === user.id;
      const friendship = viewer ? await getFriendship(viewer.id, user.id) : "none";
      const { friends } = await listFriends(user.id);
      const hideList = user.friendsHidden && !isSelf;
      const scenarioCatalog = require("./scenario-catalog-store");
      const publishedScenarioCount = await scenarioCatalog.countPublishedByAuthor(user.id);
      res.json({
        user: await enrichPublicUser(user),
        friendship,
        friends: hideList ? [] : friends,
        friendsCount: friends.length,
        friendsHidden: !!user.friendsHidden,
        publishedScenarioCount,
      });
    } catch (err) {
      console.error("user profile error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/game/custom-scenario", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const saved = await getCustomBackstory(user.id);
      res.json({
        customBackstory: catalogRuntime.sanitizeCustomBackstory(saved) || null,
      });
    } catch (err) {
      console.error("custom scenario get", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.put("/api/game/custom-scenario", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!hasPremiumAccess(user)) {
        res.status(403).json({ error: "Доступно с подпиской Премиум." });
        return;
      }
      const custom = catalogRuntime.sanitizeCustomBackstory(req.body?.customBackstory);
      if (!custom) {
        res.status(400).json({ error: "Укажите название и описание катастрофы." });
        return;
      }
      await setCustomBackstory(user.id, custom);
      res.json({ ok: true, customBackstory: custom });
    } catch (err) {
      console.error("custom scenario put", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await verifyToken(getBearerToken(req));
      if (!user) {
        res.status(401).json({ error: "Не авторизован." });
        return;
      }
      res.json({ user: await enrichPublicUser(user) });
    } catch (err) {
      console.error("me error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.patch("/api/auth/profile", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      const result = await updateProfile(user.id, req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ user: result.user });
    } catch (err) {
      console.error("profile error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/auth/avatar", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;

      const { image, crop } = req.body || {};
      if (!image || typeof image !== "string") {
        res.status(400).json({ error: "Нет изображения." });
        return;
      }

      const match = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      if (!match) {
        res.status(400).json({ error: "Неверный формат изображения." });
        return;
      }

      let buffer;
      try {
        buffer = Buffer.from(match[2], "base64");
      } catch {
        res.status(400).json({ error: "Не удалось прочитать файл." });
        return;
      }

      if (buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: "Файл больше 5 МБ." });
        return;
      }

      const meta = await sharp(buffer).metadata();
      const w = meta.width || 1;
      const h = meta.height || 1;

      const cx = Math.max(0, Math.min(1, Number(crop?.x) || 0));
      const cy = Math.max(0, Math.min(1, Number(crop?.y) || 0));
      const cw = Math.max(0.05, Math.min(1 - cx, Number(crop?.w) || 1));
      const ch = Math.max(0.05, Math.min(1 - cy, Number(crop?.h) || 1));

      const left = Math.floor(cx * w);
      const top = Math.floor(cy * h);
      const width = Math.max(1, Math.floor(cw * w));
      const height = Math.max(1, Math.floor(ch * h));
      const size = Math.min(width, height);

      const webp = await sharp(buffer)
        .extract({ left, top, width: size, height: size })
        .resize(256, 256, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();

      const updated = await setAvatarBuffer(user.id, webp);
      res.json({ user: updated });
    } catch (err) {
      console.error("avatar upload error", err);
      res.status(500).json({ error: "Не удалось обработать изображение." });
    }
  });

  app.post("/api/auth/banner", async (req, res) => {
    try {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!canUseBanner(user)) {
        res.status(403).json({ error: "Баннер доступен только для Premium и разработчиков." });
        return;
      }

      const { image, crop } = req.body || {};
      if (!image || typeof image !== "string") {
        res.status(400).json({ error: "Нет изображения." });
        return;
      }

      const match = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      if (!match) {
        res.status(400).json({ error: "Неверный формат изображения." });
        return;
      }

      let buffer;
      try {
        buffer = Buffer.from(match[2], "base64");
      } catch {
        res.status(400).json({ error: "Не удалось прочитать файл." });
        return;
      }

      if (buffer.length > 8 * 1024 * 1024) {
        res.status(400).json({ error: "Файл больше 8 МБ." });
        return;
      }

      const meta = await sharp(buffer).metadata();
      const w = meta.width || 1;
      const h = meta.height || 1;

      const cx = Math.max(0, Math.min(1, Number(crop?.x) || 0));
      const cy = Math.max(0, Math.min(1, Number(crop?.y) || 0));
      const cw = Math.max(0.05, Math.min(1 - cx, Number(crop?.w) || 1));
      const ch = Math.max(0.05, Math.min(1 - cy, Number(crop?.h) || 0.34));

      const left = Math.floor(cx * w);
      const top = Math.floor(cy * h);
      const width = Math.max(1, Math.floor(cw * w));
      const height = Math.max(1, Math.floor(ch * h));

      const webp = await sharp(buffer)
        .extract({ left, top, width, height })
        .resize(1200, 400, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();

      const updated = await setBannerBuffer(user.id, webp);
      res.json({ user: updated });
    } catch (err) {
      console.error("banner upload error", err);
      res.status(500).json({ error: "Не удалось обработать баннер." });
    }
  });
}

async function resolvePlayerIdentity(payload) {
  const token = payload?.authToken || payload?.token;
  const authUser = token ? await verifyToken(token) : null;

  if (!authUser) {
    const name = (payload?.name || "").trim().slice(0, 24);
    return {
      ok: true,
      isGuest: true,
      displayName: name,
      userId: null,
      nickname: null,
      avatarUrl: GUEST_AVATAR,
    };
  }

  const sessionName = (payload?.name || payload?.sessionName || "")
    .trim()
    .slice(0, 24);
  const displayName = sessionName || authUser.nickname;
  const pub = publicUser(authUser);

  return {
    ok: true,
    isGuest: false,
    displayName,
    userId: authUser.id,
    nickname: authUser.nickname,
    avatarUrl: pub.avatarUrl || DEFAULT_AVATAR,
    premium: hasPremiumAccess(authUser),
    dev: !!authUser.dev,
    nameMode: sessionName ? "session" : "nickname",
  };
}

module.exports = {
  mountAuthRoutes,
  resolvePlayerIdentity,
  requireUser,
  GUEST_AVATAR,
  DEFAULT_AVATAR,
};
