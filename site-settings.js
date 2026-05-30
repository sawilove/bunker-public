const { getPool } = require("./db");
const { verifyToken } = require("./user-store");
const catalogRuntime = require("./catalog-runtime");

const KEY_MAINTENANCE = "maintenance";
let maintenanceEnabled = false;

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

function getTokenFromRequest(req) {
  const bearer = getBearerToken(req);
  if (bearer) return bearer;
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)bunker_token=([^;]*)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function loadSiteSettings() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT value FROM site_settings WHERE key = $1`,
      [KEY_MAINTENANCE]
    );
    maintenanceEnabled = rows[0]?.value === "true";
    await catalogRuntime.loadCatalogOverrides(pool);
    const scenarioCatalog = require("./scenario-catalog-store");
    await scenarioCatalog.refreshPublishedCache();
  } catch (err) {
    if (err.code !== "42P01") console.error("site settings load:", err.message);
  }
}

async function setMaintenance(enabled) {
  maintenanceEnabled = !!enabled;
  await getPool().query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [KEY_MAINTENANCE, maintenanceEnabled ? "true" : "false"]
  );
}

function isMaintenanceEnabled() {
  return maintenanceEnabled;
}

async function isDevUser(req) {
  const user = await verifyToken(getTokenFromRequest(req));
  return !!user?.dev;
}

function mountDevRoutes(app) {
  app.get("/api/dev/settings", async (req, res) => {
    try {
      if (!(await isDevUser(req))) {
        res.status(403).json({ error: "Доступ только для разработчиков." });
        return;
      }
      res.json({ maintenance: maintenanceEnabled });
    } catch (err) {
      console.error("dev settings get", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.post("/api/dev/maintenance", async (req, res) => {
    try {
      if (!(await isDevUser(req))) {
        res.status(403).json({ error: "Доступ только для разработчиков." });
        return;
      }
      await setMaintenance(!!req.body?.enabled);
      res.json({ ok: true, maintenance: maintenanceEnabled });
    } catch (err) {
      console.error("dev maintenance", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.get("/api/dev/game-catalog", async (req, res) => {
    try {
      if (!(await isDevUser(req))) {
        res.status(403).json({ error: "Доступ только для разработчиков." });
        return;
      }
      const { gameData } = catalogRuntime;
      res.json({
        backstories: catalogRuntime.getEffectiveBackstories(),
        backstoryOverrides: catalogRuntime.getDevCatalogState().backstoryOverrides,
        cardPoolOverrides: catalogRuntime.getDevCatalogState().cardPoolOverrides,
        cardTypes: gameData.CARD_TYPES,
        cardPools: catalogRuntime.mergeCardPools("nuclear", null),
      });
    } catch (err) {
      console.error("dev game-catalog get", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });

  app.put("/api/dev/game-catalog", async (req, res) => {
    try {
      if (!(await isDevUser(req))) {
        res.status(403).json({ error: "Доступ только для разработчиков." });
        return;
      }
      const pool = getPool();
      if (req.body?.backstoryOverrides !== undefined) {
        await catalogRuntime.saveDevBackstoryOverrides(pool, req.body.backstoryOverrides || {});
      }
      if (req.body?.cardPoolOverrides !== undefined) {
        await catalogRuntime.saveDevCardPoolOverrides(pool, req.body.cardPoolOverrides || {});
      }
      res.json({ ok: true, ...catalogRuntime.getDevCatalogState() });
    } catch (err) {
      console.error("dev game-catalog put", err);
      res.status(500).json({ error: "Ошибка сервера." });
    }
  });
}

function isStaticAsset(p) {
  return (
    /\.(js|css|png|jpe?g|webp|svg|ico|woff2?|map)$/i.test(p) ||
    p === "/config.js" ||
    p.startsWith("/api/avatars/") ||
    p.startsWith("/api/banners/") ||
    p.startsWith("/api/news/media/") ||
    p.startsWith("/icons/")
  );
}

function maintenanceMiddleware(req, res, next) {
  if (!maintenanceEnabled) {
    next();
    return;
  }

  const p = req.path || "";

  if (
    p === "/maintenance.html" ||
    p === "/account.html" ||
    p === "/account" ||
    p === "/auth" ||
    p === "/auth.html" ||
    p.startsWith("/user/") ||
    p === "/profile" ||
    p === "/news" ||
    p === "/friends" ||
    p === "/achievements" ||
    p === "/host" ||
    p === "/player" ||
    /^\/game\/[^/]+\/?$/i.test(p) ||
    p === "/api/dev/settings" ||
    p === "/api/dev/maintenance" ||
    p === "/api/dev/game-catalog" ||
    p.startsWith("/api/friends") ||
    p.startsWith("/api/achievements") ||
    p.startsWith("/api/auth/achievements") ||
    p.startsWith("/api/chat/") ||
    p.startsWith("/api/game/") ||
    p.startsWith("/api/scenarios/") ||
    p.startsWith("/api/dev/scenarios") ||
    p.startsWith("/socket.io") ||
    isStaticAsset(p)
  ) {
    next();
    return;
  }

  if (
    p.startsWith("/api/auth/login") ||
    p.startsWith("/api/auth/register") ||
    p.startsWith("/api/auth/me")
  ) {
    next();
    return;
  }

  isDevUser(req)
    .then((dev) => {
      if (dev) {
        next();
        return;
      }

      if (p.startsWith("/api/")) {
        res.status(503).json({
          error: "Сайт на техническом обслуживании.",
          maintenance: true,
        });
        return;
      }

      res.status(503).sendFile(
        require("path").join(__dirname, "public", "maintenance.html")
      );
    })
    .catch(() => {
      res.status(503).sendFile(
        require("path").join(__dirname, "public", "maintenance.html")
      );
    });
}

module.exports = {
  loadSiteSettings,
  mountDevRoutes,
  maintenanceMiddleware,
  isMaintenanceEnabled,
};
