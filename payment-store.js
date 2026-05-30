const crypto = require("crypto");
const { getPool } = require("./db");
const { findByNickname, getUserById, getUserByPublicId } = require("./user-store");

const PLAN_DAYS = {
  "1 день": 1,
  "7 дней": 7,
  "30 дней": 30,
  "1 год": 365,
};

const PLAN_PRICES = {
  1: 49,
  7: 199,
  30: 499,
  365: 2990,
};

async function grantPremiumDays(userId, days) {
  const d = Math.max(1, Math.min(3650, Math.floor(Number(days) || 30)));
  await getPool().query(
    `UPDATE users SET
       premium_until = CASE
         WHEN premium_until IS NOT NULL AND premium_until > NOW()
         THEN premium_until + ($2 || ' days')::interval
         ELSE NOW() + ($2 || ' days')::interval
       END,
       premium = false
     WHERE id = $1`,
    [userId, String(d)]
  );
  const user = await getUserById(userId);
  const { syncAchievementsForUser } = require("./achievement-store");
  await syncAchievementsForUser(userId);
  return user;
}

function parsePremiumComment(comment) {
  const text = (comment || "").trim();
  if (!text) return null;

  const machine = text.match(/^premium:([a-z0-9]+):(\d+)d$/i);
  if (machine) {
    return { userRef: machine[1], days: Number(machine[2]) };
  }

  const human = text.match(/^Премиум\s+(.+?)\s+[—-]\s+(.+)$/i);
  if (human) {
    const planLabel = human[1].trim();
    const nickname = human[2].trim();
    const days = PLAN_DAYS[planLabel];
    if (days && nickname) return { nickname, days };
  }

  return null;
}

async function resolveUserFromPayment(parsed) {
  if (parsed.nickname) {
    const user = await findByNickname(parsed.nickname);
    if (user) return user;
  }
  if (parsed.userRef) {
    const byId = await getUserById(parsed.userRef);
    if (byId) return byId;
    return getUserByPublicId(parsed.userRef);
  }
  return null;
}

async function processPaymentWebhook({ externalId, amount, comment, source = "cloudtips" }) {
  if (!externalId) return { ok: false, error: "Нет идентификатора платежа." };

  const existing = await getPool().query(
    `SELECT id FROM payments WHERE external_id = $1`,
    [String(externalId)]
  );
  if (existing.rows[0]) {
    return { ok: true, duplicate: true, paymentId: existing.rows[0].id };
  }

  const parsed = parsePremiumComment(comment);
  if (!parsed?.days) {
    return { ok: false, error: "Не удалось разобрать комментарий к платежу." };
  }

  const user = await resolveUserFromPayment(parsed);
  if (!user) {
    return { ok: false, error: "Пользователь не найден по комментарию." };
  }

  const id = crypto.randomBytes(12).toString("hex");
  const amt = Number(amount) || 0;

  await getPool().query(
    `INSERT INTO payments (id, external_id, user_id, amount, plan_days, comment, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, String(externalId), user.id, amt, parsed.days, comment || "", source]
  );

  await grantPremiumDays(user.id, parsed.days);

  try {
    const { sendPremiumActivated } = require("./mailer");
    if (user.email) {
      await sendPremiumActivated(user.email, user.nickname, parsed.days);
    }
  } catch (err) {
    console.error("premium email error", err);
  }

  return {
    ok: true,
    paymentId: id,
    userId: user.id,
    nickname: user.nickname,
    days: parsed.days,
  };
}

async function listPayments(limit = 50) {
  const { rows } = await getPool().query(
    `SELECT p.*, u.nickname
     FROM payments p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC
     LIMIT $1`,
    [Math.min(limit, 100)]
  );
  return rows.map((r) => ({
    id: r.id,
    externalId: r.external_id,
    userId: r.user_id,
    nickname: r.nickname,
    amount: Number(r.amount),
    planDays: r.plan_days,
    comment: r.comment,
    source: r.source,
    createdAt: r.created_at,
  }));
}

async function manualGrantPremium(devUserId, targetUserId, days) {
  const target = await getUserById(targetUserId);
  if (!target) return { ok: false, error: "Игрок не найден." };
  const d = Math.max(1, Math.min(3650, Math.floor(Number(days) || 30)));
  await grantPremiumDays(targetUserId, d);
  const id = crypto.randomBytes(12).toString("hex");
  await getPool().query(
    `INSERT INTO payments (id, external_id, user_id, amount, plan_days, comment, source)
     VALUES ($1, $2, $3, 0, $4, $5, 'manual')`,
    [id, `manual-${id}`, targetUserId, d, `manual grant by ${devUserId}`, "manual"]
  );
  return { ok: true, userId: targetUserId, days: d };
}

module.exports = {
  PLAN_DAYS,
  PLAN_PRICES,
  parsePremiumComment,
  processPaymentWebhook,
  grantPremiumDays,
  listPayments,
  manualGrantPremium,
};
