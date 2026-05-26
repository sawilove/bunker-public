async function verifyTurnstile(token, remoteip) {
  const secret =
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.CLOUDFLARE_SECRET ||
    process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token || typeof token !== "string") return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteip || undefined,
      }),
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error("turnstile verify error", err);
    return false;
  }
}

module.exports = { verifyTurnstile };
