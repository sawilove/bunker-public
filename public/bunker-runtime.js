(function () {
  const STORAGE_HOST = "bunker:hostId";
  const STORAGE_PLAYER = "bunker:playerId";
  const STORAGE_CODE = "bunker:sessionCode";
  const STORAGE_NAME = "bunker:playerName";

  function detectBasePath() {
    const meta = document.querySelector('meta[name="bunker-base"]');
    if (meta?.content) {
      return meta.content.replace(/\/$/, "") || "";
    }
    const path = location.pathname.replace(/\\/g, "/");
    if (path.endsWith("/")) {
      return path.slice(0, -1) || "";
    }
    const last = path.split("/").pop() || "";
    if (last.includes(".")) {
      return path.slice(0, path.lastIndexOf("/")) || "";
    }
    return path || "";
  }

  const basePath = detectBasePath();
  const config = window.BUNKER_CONFIG || {};

  function assetUrl(relativePath) {
    const clean = relativePath.replace(/^\//, "");
    return `${basePath}/${clean}`;
  }

  function pageUrl(filename) {
    return assetUrl(filename);
  }

  function playerJoinUrl(code) {
    const q = encodeURIComponent(code);
    return `${location.origin}${basePath}/player.html?code=${q}`;
  }

  function qrImageUrl(data) {
    const apiBase = (config.apiUrl || config.wsUrl || "").replace(/\/$/, "");
    if (apiBase) {
      return `${apiBase}/api/qr.png?data=${encodeURIComponent(data)}`;
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=2&data=${encodeURIComponent(data)}`;
  }

  function connectSocket() {
    const opts = { transports: ["websocket", "polling"] };
    if (config.wsUrl) {
      return io(config.wsUrl, opts);
    }
    return io(opts);
  }

  function getHostId() {
    return localStorage.getItem(STORAGE_HOST) || "";
  }

  function saveHostId(id) {
    if (id) localStorage.setItem(STORAGE_HOST, id);
    else localStorage.removeItem(STORAGE_HOST);
  }

  function getPlayerSession() {
    return {
      playerId: localStorage.getItem(STORAGE_PLAYER) || "",
      code: localStorage.getItem(STORAGE_CODE) || "",
      name: localStorage.getItem(STORAGE_NAME) || "",
    };
  }

  function savePlayerSession({ playerId, code, name }) {
    if (playerId) localStorage.setItem(STORAGE_PLAYER, playerId);
    if (code) localStorage.setItem(STORAGE_CODE, code);
    if (name) localStorage.setItem(STORAGE_NAME, name);
  }

  function clearPlayerSession() {
    localStorage.removeItem(STORAGE_PLAYER);
    localStorage.removeItem(STORAGE_CODE);
    localStorage.removeItem(STORAGE_NAME);
  }

  window.BunkerRuntime = {
    basePath,
    assetUrl,
    pageUrl,
    playerJoinUrl,
    qrImageUrl,
    connectSocket,
    getHostId,
    saveHostId,
    getPlayerSession,
    savePlayerSession,
    clearPlayerSession,
  };
})();
