const nodemailer = require("nodemailer");

let transporter = null;

function mailFrom() {
  return (
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    "Bunker <no-reply@tusa.team>"
  );
}

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
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

async function sendEmailCode(toEmail, code, purpose) {
  const transport = getTransporter();
  if (!transport) {
    throw new Error("Почта на сервере не настроена (SMTP_USER / SMTP_PASS).");
  }

  const subject = purposeSubject(purpose);
  const text = purposeText(purpose, code);

  await transport.sendMail({
    from: mailFrom(),
    to: toEmail,
    subject,
    text,
  });
}

function isMailConfigured() {
  return !!getTransporter();
}

module.exports = {
  sendEmailCode,
  isMailConfigured,
  mailFrom,
};
