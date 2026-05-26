const nodemailer = require("nodemailer");

let transporter = null;

/** Пример адреса: user@domain.tld без угловых скобок. */
const LOOSE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * MAIL_FROM может быть указан ошибочно как `<you@domain.com>` (только скобки) — так Resend отклоняет.
 * Допустимые результаты: `you@domain.com` или `Имя <you@domain.com>`.
 */
function parseMailFromEnv() {
  const raw = (
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    ""
  ).trim();
  if (!raw) return null;

  const nameEmail = raw.match(/^(.+?)\s*<\s*([^<>]+@\S+)\s*>\s*$/);
  if (nameEmail) {
    const name = nameEmail[1].trim().replace(/^["']|["']$/g, "");
    const addr = nameEmail[2].trim();
    if (LOOSE_EMAIL.test(addr) && name) return `${name} <${addr}>`;
    if (LOOSE_EMAIL.test(addr)) return addr;
    return null;
  }

  const onlyBrackets = raw.match(/^<\s*([^<>]+@\S+)\s*>\s*$/);
  if (onlyBrackets && LOOSE_EMAIL.test(onlyBrackets[1].trim())) {
    return onlyBrackets[1].trim();
  }

  if (LOOSE_EMAIL.test(raw)) return raw;

  return null;
}

function mailFrom() {
  const parsed = parseMailFromEnv();
  if (!useResend()) {
    if (parsed) return parsed;
    return "Bunker <no-reply@tusa.team>";
  }

  if (!parsed) return "Bunker <onboarding@resend.dev>";

  /** Тестовый домен Resend допускает в «from» только onboarding@… */
  const addr = parsed.includes("<")
    ? (parsed.match(/<([^>]+@[^>]+)>/) || [, ""])[1].trim()
    : parsed.trim();
  if (addr.endsWith("@resend.dev") && addr !== "onboarding@resend.dev") {
    return "Bunker <onboarding@resend.dev>";
  }

  return parsed;
}

function resendApiKey() {
  return (process.env.RESEND_API_KEY || "").trim();
}

function useResend() {
  return !!resendApiKey();
}

function getTransporter() {
  if (transporter) return transporter;
  if (useResend()) return null;

  const userRaw = process.env.SMTP_USER || process.env.GMAIL_USER;
  const passRaw = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const user = (userRaw || "").trim();
  const pass = (passRaw || "").replace(/\s+/g, "");
  if (!user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return transporter;
}

function purposeSubject(purpose) {
  if (purpose === "reset") return "Сброс пароля — Бункер";
  return "Код подтверждения — Бункер";
}

function purposeText(purpose, code) {
  if (purpose === "reset") {
    return [
      "Вы запросили сброс пароля в игре «Бункер».",
      "",
      `Код: ${code}`,
      "",
      "Код действует 15 минут. Если вы не запрашивали сброс — проигнорируйте письмо.",
    ].join("\n");
  }
  return [
    "Подтверждение регистрации в игре «Бункер».",
    "",
    `Код: ${code}`,
    "",
    "Код действует 15 минут.",
  ].join("\n");
}

async function sendViaResend(toEmail, subject, text) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [toEmail],
      subject,
      text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || `Resend HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function sendViaSmtp(toEmail, subject, text) {
  const transport = getTransporter();
  if (!transport) {
    throw new Error("Почта не настроена: укажите RESEND_API_KEY (Render) или SMTP_USER/SMTP_PASS (локально).");
  }

  await transport.sendMail({
    from: mailFrom(),
    to: toEmail,
    subject,
    text,
  });
}

function wrapSmtpError(err) {
  if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED" || err.code === "ESOCKET") {
    return new Error(
      "Gmail SMTP недоступен с Render (порты 587/465 заблокированы). Добавьте RESEND_API_KEY в Environment."
    );
  }
  return err;
}

async function sendEmailCode(toEmail, code, purpose) {
  const subject = purposeSubject(purpose);
  const text = purposeText(purpose, code);

  try {
    if (useResend()) {
      await sendViaResend(toEmail, subject, text);
      return;
    }
    await sendViaSmtp(toEmail, subject, text);
  } catch (err) {
    throw wrapSmtpError(err);
  }
}

function isMailConfigured() {
  return useResend() || !!getTransporter();
}

module.exports = {
  sendEmailCode,
  isMailConfigured,
  mailFrom,
  useResend,
};
