const path = require("path");
const sharp = require("sharp");
const {
  register,
  login,
  verifyToken,
  publicUser,
  updateProfile,
  setAvatarBuffer,
  getAvatarBuffer,
} = require("./user-store");

const GUEST_AVATAR = "/icons/guest-avatar.svg";
const DEFAULT_AVATAR = "/icons/default-avatar.svg";

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

async function requireUser(req, res) {
  const user = await verifyToken(getBearerToken(req));
  if (!user) {
    res.status(401).json({ error: "Требуется вход в аккаунт." });
    return null;
  }
  return user;
}

function mountAuthRoutes(app) {
  app.get("/account", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "account.html"));
  });

  app.get("/api/avatars/:userId", async (req, res) => {
    try {
      const buf = await getAvatarBuffer(req.params.userId);
      if (!buf) {
        res.status(404).end();
        return;
      }
      res.set("Cache-Control", "public, max-age=3600");
      res.type("image/webp").send(buf);
    } catch (err) {
      console.error("avatar get error", err);
      res.status(500).end();
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = await register(req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ user: result.user, token: result.token });
    } catch (err) {
      console.error("register error", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = await login(req.body || {});
      if (!result.ok) {
        res.status(401).json({ error: result.error });
        return;
      }
      res.json({ user: result.user, token: result.token });
    } catch (err) {
      console.error("login error", err);
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
      res.json({ user: publicUser(user) });
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

      const webp = await sharp(buffer)
        .extract({ left, top, width, height })
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

  const mode = payload?.nameMode === "session" ? "session" : "nickname";
  let displayName = authUser.nickname;

  if (mode === "session") {
    const sessionName = (payload?.name || payload?.sessionName || "")
      .trim()
      .slice(0, 24);
    if (!sessionName) {
      return { ok: false, error: "Введите имя для этой сессии." };
    }
    displayName = sessionName;
  }

  const pub = publicUser(authUser);
  return {
    ok: true,
    isGuest: false,
    displayName,
    userId: authUser.id,
    nickname: authUser.nickname,
    avatarUrl: pub.avatarUrl || DEFAULT_AVATAR,
    nameMode: mode,
  };
}

module.exports = {
  mountAuthRoutes,
  resolvePlayerIdentity,
  GUEST_AVATAR,
  DEFAULT_AVATAR,
};
