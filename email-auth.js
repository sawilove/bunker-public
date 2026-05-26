const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getPool } = require("./db");
const { sendEmailCode, isMailConfigured } = require("./mailer");

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function validateEmail(email) {
  const e = normalizeEmail(email);
  if (!e || e.length > 254) return "Укажите корректный email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return "Укажите корректный email.";
  }
  return null;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code).trim()).digest("hex");
}

async function findUserByEmail(email) {
  const key = normalizeEmail(email);
  const { rows } = await getPool().query(
    `SELECT id FROM users WHERE email_lower = $1`,
    [key]
  );
  return rows[0]?.id || null;
}

async function issueEmailCode(email, purpose) {
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };

  const purposeNorm = purpose === "reset" ? "reset" : "register";
  const key = normalizeEmail(email);

  if (purposeNorm === "register") {
    const existing = await findUserByEmail(key);
    if (existing) {
      return { ok: false, error: "Этот email уже зарегистрирован." };
    }
  }

  if (!isMailConfigured()) {
    return {
      ok: false,
      error: "Отправка почты не настроена на сервере. Добавьте SMTP_USER и SMTP_PASS.",
    };
  }

  const { rows: recent } = await getPool().query(
    `SELECT created_at FROM email_codes
     WHERE email_lower = $1 AND purpose = $2
     ORDER BY created_at DESC LIMIT 1`,
    [key, purposeNorm]
  );
  if (recent[0]) {
    const age = Date.now() - new Date(recent[0].created_at).getTime();
    if (age < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: "Подождите минуту перед повторной отправкой кода.",
      };
    }
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await getPool().query(
    `DELETE FROM email_codes WHERE email_lower = $1 AND purpose = $2`,
    [key, purposeNorm]
  );
  await getPool().query(
    `INSERT INTO email_codes (email_lower, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [key, purposeNorm, codeHash, expiresAt]
  );

  if (purposeNorm === "reset") {
    const userId = await findUserByEmail(key);
    if (!userId) {
      return { ok: true, message: "Если email зарегистрирован, код отправлен." };
    }
  }

  try {
    await sendEmailCode(key, code, purposeNorm);
  } catch (err) {
    console.error("send email error", err);
    return { ok: false, error: "Не удалось отправить письмо. Проверьте SMTP на сервере." };
  }

  return { ok: true, message: "Код отправлен на почту." };
}

async function verifyEmailCode(email, purpose, verificationCode) {
  const key = normalizeEmail(email);
  const purposeNorm = purpose === "reset" ? "reset" : "register";
  const codeHash = hashCode(verificationCode);

  const { rows } = await getPool().query(
    `SELECT code_hash, expires_at FROM email_codes
     WHERE email_lower = $1 AND purpose = $2`,
    [key, purposeNorm]
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Код не найден. Запросите новый." };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Код истёк. Запросите новый." };
  }
  if (row.code_hash !== codeHash) {
    return { ok: false, error: "Неверный код подтверждения." };
  }

  await getPool().query(
    `DELETE FROM email_codes WHERE email_lower = $1 AND purpose = $2`,
    [key, purposeNorm]
  );

  return { ok: true, email: key };
}

module.exports = {
  normalizeEmail,
  validateEmail,
  issueEmailCode,
  verifyEmailCode,
  findUserByEmail,
};
