const nodemailer = require("nodemailer");

let transporter = null;

function mailFrom() {
  return (
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    (process.env.RESEND_API_KEY
      ? "Bunker <onboarding@resend.dev>"
      : "Bunker <no-reply@tusa.team>")
  );
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
