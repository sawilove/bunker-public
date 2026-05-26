(function () {
  const STORAGE_TOKEN = "bunker:authToken";
  const config = window.BUNKER_CONFIG || {};

  function apiBase() {
    return (config.apiUrl || config.wsUrl || "").replace(/\/$/, "");
  }

  function assetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const base = apiBase();
    if (
      (path.startsWith("/uploads/") ||
        path.startsWith("/api/avatars/") ||
        path.startsWith("/api/banners/")) &&
      base
    ) {
      return `${base}${path}`;
    }
    if (window.BunkerRuntime) return BunkerRuntime.assetUrl(path.replace(/^\//, ""));
    return path;
  }

  function avatarUrlForUser(user, bust) {
    if (!user?.avatarUrl) {
      return assetUrl("/icons/default-avatar.svg");
    }
    let url = assetUrl(user.avatarUrl);
    if (bust) {
      const sep = url.includes("?") ? "&" : "?";
      url += `${sep}bust=${bust}`;
    }
    return url;
  }

  function getToken() {
    return localStorage.getItem(STORAGE_TOKEN) || "";
  }

  const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

  function syncAuthCookie(token) {
    if (token) {
      document.cookie = `bunker_token=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    } else {
      document.cookie = "bunker_token=; path=/; max-age=0; SameSite=Lax";
    }
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(STORAGE_TOKEN, token);
      syncAuthCookie(token);
    } else {
      localStorage.removeItem(STORAGE_TOKEN);
      syncAuthCookie("");
    }
  }

  function clearAuth() {
    setToken("");
  }

  if (getToken()) syncAuthCookie(getToken());

  async function api(path, options = {}) {
    const base = apiBase();
    if (!base) throw new Error("API не настроен. Укажите apiUrl в config.js");
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${base}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Ошибка запроса");
    }
    return data;
  }

  async function register(nickname, password) {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ nickname, password }),
    });
    setToken(data.token);
    return data.user;
  }

  async function login(nickname, password) {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ nickname, password }),
    });
    setToken(data.token);
    return data.user;
  }

  async function fetchMe() {
    if (!getToken()) return null;
    try {
      const data = await api("/api/auth/me");
      return data.user;
    } catch {
      clearAuth();
      return null;
    }
  }

  async function updateProfile(fields) {
    const data = await api("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(fields || {}),
    });
    return data.user;
  }

  async function fetchUser(userId) {
    return api(`/api/users/${encodeURIComponent(userId)}`);
  }

  async function uploadAvatar(imageDataUrl, crop) {
    const data = await api("/api/auth/avatar", {
      method: "POST",
      body: JSON.stringify({ image: imageDataUrl, crop }),
    });
    return data.user;
  }

  async function uploadBanner(imageDataUrl, crop) {
    const data = await api("/api/auth/banner", {
      method: "POST",
      body: JSON.stringify({ image: imageDataUrl, crop }),
    });
    return data.user;
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function getFriends() {
    return api("/api/friends");
  }

  async function searchUsers(q) {
    const data = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
    return data.users || [];
  }

  async function requestFriend(nickname) {
    return api("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ nickname }),
    });
  }

  async function requestFriendById(userId) {
    return api("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  async function respondFriend(userId, accept) {
    return api("/api/friends/respond", {
      method: "POST",
      body: JSON.stringify({ userId, accept }),
    });
  }

  async function removeFriend(peerId) {
    return api(`/api/friends/${encodeURIComponent(peerId)}`, {
      method: "DELETE",
    });
  }

  async function getChat(peerId) {
    return api(`/api/chat/${encodeURIComponent(peerId)}`);
  }

  function profileUrl(userId) {
    if (!userId) return pageUrl("account.html");
    return pageUrl(`profile.html?id=${encodeURIComponent(userId)}`);
  }

  function pageUrl(filename) {
    if (window.BunkerRuntime) return BunkerRuntime.pageUrl(filename);
    return filename;
  }

  async function getDevSettings() {
    return api("/api/dev/settings");
  }

  async function setMaintenance(enabled) {
    return api("/api/dev/maintenance", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
  }

  async function getNews(category) {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return api(`/api/news${q}`);
  }

  async function getNewsCategories() {
    return api("/api/news/categories");
  }

  async function createNews(data) {
    return api("/api/news", { method: "POST", body: JSON.stringify(data) });
  }

  async function updateNews(id, data) {
    return api(`/api/news/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async function deleteNews(id) {
    return api(`/api/news/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function uploadNewsMedia(fileDataUrl, mimeType) {
    return api("/api/news/media", {
      method: "POST",
      body: JSON.stringify({ file: fileDataUrl, mimeType }),
    });
  }

  function newsMediaUrl(mediaId) {
    const base = apiBase();
    return base ? `${base}/api/news/media/${mediaId}` : `/api/news/media/${mediaId}`;
  }

  window.BunkerAuth = {
    apiBase,
    assetUrl,
    avatarUrlForUser,
    getToken,
    setToken,
    clearAuth,
    register,
    login,
    fetchMe,
    updateProfile,
    fetchUser,
    uploadAvatar,
    uploadBanner,
    isLoggedIn,
    getFriends,
    searchUsers,
    requestFriend,
    requestFriendById,
    respondFriend,
    removeFriend,
    getChat,
    profileUrl,
    pageUrl,
    getDevSettings,
    setMaintenance,
    getNews,
    getNewsCategories,
    createNews,
    updateNews,
    deleteNews,
    uploadNewsMedia,
    newsMediaUrl,
  };
})();
