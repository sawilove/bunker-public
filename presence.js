/** In-memory presence: offline | online | in_game */

const socialSockets = new Map();
const inGameUsers = new Set();

function addSocialSocket(userId, socketId) {
  if (!socialSockets.has(userId)) socialSockets.set(userId, new Set());
  socialSockets.get(userId).add(socketId);
}

function removeSocialSocket(userId, socketId) {
  const set = socialSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) socialSockets.delete(userId);
}

function setUserInGame(userId, inGame) {
  if (!userId) return;
  if (inGame) inGameUsers.add(userId);
  else inGameUsers.delete(userId);
}

function getUserStatus(userId) {
  if (!userId) return "offline";
  if (inGameUsers.has(userId)) return "in_game";
  if (socialSockets.has(userId) && socialSockets.get(userId).size > 0) {
    return "online";
  }
  return "offline";
}

function statusLabel(status) {
  if (status === "in_game") return "В игре";
  if (status === "online") return "В сети";
  return "Не в сети";
}

function syncInGameFromPlayers(players, phase) {
  inGameUsers.clear();
  if (phase === "setup") return;
  for (const p of Object.values(players || {})) {
    if (p?.userId) inGameUsers.add(p.userId);
  }
}

module.exports = {
  addSocialSocket,
  removeSocialSocket,
  setUserInGame,
  getUserStatus,
  statusLabel,
  syncInGameFromPlayers,
};
