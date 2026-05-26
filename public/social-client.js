(function () {
  const config = window.BUNKER_CONFIG || {};
  let socket = null;
  let connected = false;
  const inviteHandlers = [];
  const chatHandlers = [];
  const presenceHandlers = [];
  const friendRequestHandlers = [];

  function wsBase() {
    return (config.wsUrl || config.apiUrl || "").replace(/\/$/, "");
  }

  function connect() {
    if (!window.BunkerAuth || !BunkerAuth.getToken() || !wsBase()) return null;
    if (socket?.connected) return socket;

    const opts = { transports: ["websocket", "polling"] };
    socket = config.wsUrl ? io(config.wsUrl, opts) : io(opts);

    socket.on("connect", () => {
      socket.emit("social:connect", { token: BunkerAuth.getToken() });
    });

    socket.on("social:connected", () => {
      connected = true;
    });

    socket.on("chat:message", (msg) => {
      chatHandlers.forEach((fn) => fn(msg));
    });

    socket.on("friend:presence", (data) => {
      presenceHandlers.forEach((fn) => fn(data));
    });

    socket.on("session:invite", (data) => {
      inviteHandlers.forEach((fn) => fn(data));
    });

    socket.on("notification:session_invite", (data) => {
      inviteHandlers.forEach((fn) => fn(data));
    });

    socket.on("notification:friend_request", (data) => {
      friendRequestHandlers.forEach((fn) => fn(data));
    });

    return socket;
  }

  function onInvite(fn) {
    inviteHandlers.push(fn);
  }

  function onFriendRequest(fn) {
    friendRequestHandlers.push(fn);
  }

  function onChat(fn) {
    chatHandlers.push(fn);
  }

  function onPresence(fn) {
    presenceHandlers.push(fn);
  }

  function sendChat(toUserId, body) {
    if (!socket?.connected) return;
    socket.emit("chat:send", { toUserId, body });
  }

  function inviteToSession(friendUserId) {
    if (!socket?.connected) return;
    socket.emit("session:invite", { friendUserId });
  }

  window.BunkerSocial = {
    connect,
    onInvite,
    onFriendRequest,
    onChat,
    onPresence,
    sendChat,
    inviteToSession,
    isConnected: () => connected,
  };
})();
