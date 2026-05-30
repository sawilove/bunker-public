const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getPool, initDatabase, rowToUser } = require("./db");
const {
  normalizeEmail,
  validateEmail,
  verifyEmailCode,
  findUserByEmail,
} = require("./email-auth");

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SECRET =
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  "bunker-dev-secret-change-in-production";

function mediaVersion(dateField) {
  if (!dateField) return Date.now();
  const t = dateField;
  return t instanceof Date ? t.getTime() : new Date(t).getTime();
}

function publicUser(user, extra = {}) {
  if (!user) return null;
  const premiumActive = hasPremiumAccess(user);
  return {
    id: user.id,
    profileId: user.profileId || user.id,
    nickname: user.nickname,
    bio: user.bio || "",
    avatarUrl: user.avatarWebp
      ? `/api/avatars/${user.id}?v=${mediaVersion(user.avatarUpdatedAt)}`
      : null,
    bannerUrl: user.bannerWebp
      ? `/api/banners/${user.id}?v=${mediaVersion(user.bannerUpdatedAt)}`
      : null,
    friendsHidden: !!user.friendsHidden,
    gamesPlayed: user.gamesPlayed || 0,
    bunkerSurvivals: user.bunkerSurvivals || 0,
    premium: premiumActive,
    premiumUntil: user.premiumUntil || null,
    dev: !!user.dev,
    ...extra,
  };
}

function normalizeNickname(nickname) {
  return (nickname || "").trim();
}

function validateNickname(nickname) {
  const n = normalizeNickname(nickname);
  if (n.length < 3 || n.length > 20) {
    return "Никнейм: от 3 до 20 символов.";
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9_-]+$/.test(n)) {
    return "Никнейм: только буквы, цифры, _ и -.";
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    return "Пароль: минимум 6 символов.";
  }
  return null;
}

function hasPremiumAccess(user) {
  if (!user) return false;
  if (user.dev) return true;
  if (user.premium) return true; // legacy/manual permanent premium flag
  if (!user.premiumUntil) return false;
  const t = new Date(user.premiumUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function normalizeProfileId(value) {
  return (value || "").trim().toLowerCase();
}

function validateProfileId(value) {
  const id = normalizeProfileId(value);
  if (id.length < 3 || id.length > 32) {
    return "ID профиля: от 3 до 32 символов.";
  }
  if (!/^[a-z0-9_-]+$/.test(id)) {
    return "ID профиля: только латиница, цифры, _ и -.";
  }
  return null;
}

function createToken(userId) {
  const issued = Date.now();
  const payload = `${userId}.${issued}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

async function getUserById(userId) {
  const { rows } = await getPool().query(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  return rowToUser(rows[0]);
}

async function getUserByProfileId(profileId) {
  const normalized = normalizeProfileId(profileId);
  if (!normalized) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM users WHERE profile_id = $1`,
    [normalized]
  );
  return rowToUser(rows[0]);
}

async function getUserByPublicId(userIdOrProfileId) {
  if (!userIdOrProfileId) return null;
  const exact = await getUserById(userIdOrProfileId);
  if (exact) return exact;
  return getUserByProfileId(userIdOrProfileId);
}

async function findByNickname(nickname) {
  const key = normalizeNickname(nickname).toLowerCase();
  const { rows } = await getPool().query(
    `SELECT * FROM users WHERE nickname_lower = $1`,
    [key]
  );
  return rowToUser(rows[0]);
}

async function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const [userId, issuedStr] = payload.split(".");
    const issued = Number(issuedStr);
    if (!userId || !issued || Date.now() - issued > TOKEN_TTL_MS) return null;
    return getUserById(userId);
  } catch {
    return null;
  }
}

async function register({ nickname, password, email, verificationCode }) {
  const nickErr = validateNickname(nickname);
  if (nickErr) return { ok: false, error: nickErr };
  const passErr = validatePassword(password);
  if (passErr) return { ok: false, error: passErr };
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  if (!verificationCode || String(verificationCode).trim().length < 4) {
    return { ok: false, error: "Введите код из письма." };
  }

  const nick = normalizeNickname(nickname);
  if (await findByNickname(nick)) {
    return { ok: false, error: "Этот никнейм уже занят." };
  }

  const emailKey = normalizeEmail(email);
  if (await findUserByEmail(emailKey)) {
    return { ok: false, error: "Этот email уже зарегистрирован." };
  }

  const codeCheck = await verifyEmailCode(emailKey, "register", verificationCode);
  if (!codeCheck.ok) return codeCheck;

  const id = crypto.randomBytes(16).toString("hex");
  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    await getPool().query(
      `INSERT INTO users (id, profile_id, nickname, nickname_lower, password_hash, email, email_lower, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [id, id, nick, nick.toLowerCase(), passwordHash, emailKey, emailKey]
    );
  } catch (err) {
    if (err.code === "23505") {
      return { ok: false, error: "Этот никнейм или email уже занят." };
    }
    throw err;
  }

  const user = await getUserById(id);
  const { grantAchievement } = require("./achievement-store");
  await grantAchievement(id, "register");
  return { ok: true, user: publicUser(user), token: createToken(id) };
}

async function resetPassword({ email, code, newPassword }) {
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  const passErr = validatePassword(newPassword);
  if (passErr) return { ok: false, error: passErr };
  if (!code || String(code).trim().length < 4) {
    return { ok: false, error: "Введите код из письма." };
  }

  const emailKey = normalizeEmail(email);
  const userId = await findUserByEmail(emailKey);
  if (!userId) {
    return { ok: false, error: "Аккаунт с таким email не найден." };
  }

  const codeCheck = await verifyEmailCode(emailKey, "reset", code);
  if (!codeCheck.ok) return codeCheck;

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await getPool().query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
    userId,
    passwordHash,
  ]);

  return { ok: true, message: "Пароль обновлён." };
}

async function login({ nickname, password }) {
  const user = await findByNickname(nickname);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return { ok: false, error: "Неверный никнейм или пароль." };
  }
  return { ok: true, user: publicUser(user), token: createToken(user.id) };
}

async function updateProfile(userId, { bio, nickname, friendsHidden, profileId }) {
  const user = await getUserById(userId);
  if (!user) return { ok: false, error: "Пользователь не найден." };

  let bioText = user.bio;
  if (typeof bio === "string") {
    bioText = bio.trim().slice(0, 500);
  }

  let nick = user.nickname;
  if (nickname !== undefined) {
    const nickErr = validateNickname(nickname);
    if (nickErr) return { ok: false, error: nickErr };
    nick = normalizeNickname(nickname);
    if (nick.toLowerCase() !== user.nicknameLower) {
      if (await findByNickname(nick)) {
        return { ok: false, error: "Этот никнейм уже занят." };
      }
    }
  }

  let hideFriends = user.friendsHidden;
  if (typeof friendsHidden === "boolean") {
    hideFriends = friendsHidden;
  }

  let nextProfileId = user.profileId || user.id;
  if (profileId !== undefined) {
    if (!(user.dev || hasPremiumAccess(user))) {
      return { ok: false, error: "Изменение ID профиля доступно только Premium и разработчикам." };
    }
    const idErr = validateProfileId(profileId);
    if (idErr) return { ok: false, error: idErr };
    nextProfileId = normalizeProfileId(profileId);
    const { rows: sameIdRows } = await getPool().query(
      `SELECT 1 FROM users WHERE id = $1 AND id <> $2 LIMIT 1`,
      [nextProfileId, userId]
    );
    if (sameIdRows.length) {
      return { ok: false, error: "Этот ID профиля уже занят." };
    }
  }

  try {
    await getPool().query(
      `UPDATE users SET bio = $2, nickname = $3, nickname_lower = $4, friends_hidden = $5, profile_id = $6 WHERE id = $1`,
      [userId, bioText, nick, nick.toLowerCase(), hideFriends, nextProfileId]
    );
  } catch (err) {
    if (err.code === "23505") {
      if (String(err.constraint || "").includes("users_profile_id")) {
        return { ok: false, error: "Этот ID профиля уже занят." };
      }
      return { ok: false, error: "Этот никнейм уже занят." };
    }
    throw err;
  }

  const updated = await getUserById(userId);
  const { syncAchievementsForUser } = require("./achievement-store");
  syncAchievementsForUser(userId).catch((err) => {
    console.error("syncAchievements after profile", userId, err);
  });
  return { ok: true, user: publicUser(updated) };
}

async function setAvatarBuffer(userId, buffer) {
  await getPool().query(
    `UPDATE users SET avatar_webp = $2, avatar_updated_at = NOW() WHERE id = $1`,
    [userId, buffer]
  );
  const user = await getUserById(userId);
  const { syncAchievementsForUser } = require("./achievement-store");
  syncAchievementsForUser(userId).catch((err) => {
    console.error("syncAchievements after avatar", userId, err);
  });
  return publicUser(user);
}

async function getAvatarBuffer(userId) {
  const { rows } = await getPool().query(
    `SELECT avatar_webp FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.avatar_webp || null;
}

async function setBannerBuffer(userId, buffer) {
  await getPool().query(
    `UPDATE users SET banner_webp = $2, banner_updated_at = NOW() WHERE id = $1`,
    [userId, buffer]
  );
  const user = await getUserById(userId);
  return publicUser(user);
}

async function getBannerBuffer(userId) {
  const { rows } = await getPool().query(
    `SELECT banner_webp FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.banner_webp || null;
}

function canUseBanner(user) {
  return hasPremiumAccess(user);
}

async function recordGameStats(playerUserIds, survivorUserIds) {
  const played = [...new Set(playerUserIds.filter(Boolean))];
  if (played.length === 0) return;

  const survived = new Set(survivorUserIds.filter(Boolean));
  const survivors = played.filter((id) => survived.has(id));

  await getPool().query(
    `UPDATE users SET games_played = games_played + 1 WHERE id = ANY($1::text[])`,
    [played]
  );

  if (survivors.length > 0) {
    await getPool().query(
      `UPDATE users SET bunker_survivals = bunker_survivals + 1 WHERE id = ANY($1::text[])`,
      [survivors]
    );
  }

  const { syncAchievementsForUser } = require("./achievement-store");
  for (const userId of played) {
    syncAchievementsForUser(userId).catch((err) => {
      console.error("syncAchievements after game", userId, err);
    });
  }
}

async function getCustomBackstory(userId) {
  const { rows } = await getPool().query(
    `SELECT custom_backstory FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.custom_backstory || null;
}

async function setCustomBackstory(userId, data) {
  await getPool().query(`UPDATE users SET custom_backstory = $2::jsonb WHERE id = $1`, [
    userId,
    data ? JSON.stringify(data) : null,
  ]);
  return getUserById(userId);
}

module.exports = {
  initDatabase,
  register,
  resetPassword,
  login,
  verifyToken,
  publicUser,
  getUserById,
  getUserByPublicId,
  updateProfile,
  setAvatarBuffer,
  getAvatarBuffer,
  setBannerBuffer,
  getBannerBuffer,
  canUseBanner,
  hasPremiumAccess,
  recordGameStats,
  createToken,
  getCustomBackstory,
  setCustomBackstory,
};
