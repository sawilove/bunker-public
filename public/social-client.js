(function () {
  const config = window.BUNKER_CONFIG || {};
  let socket = null;
  let connected = false;
  let connectToken = null;
  const inviteHandlers = [];
  const chatHandlers = [];
  const presenceHandlers = [];
  const friendRequestHandlers = [];
  const notificationHandlers = [];
  const groupChatHandlers = [];
  const connectHandlers = [];

  function wsBase() {
    return (config.wsUrl || config.apiUrl || "").replace(/\/$/, "");
  }

  function emitSocialConnect() {
    if (!socket?.connected || !connectToken) return;
    socket.emit("social:connect", { token: connectToken });
  }

  function connect() {
    if (!window.BunkerAuth || !BunkerAuth.getToken() || !wsBase()) return null;
    connectToken = BunkerAuth.getToken();

    if (socket) {
      if (!socket.connected) socket.connect();
      else emitSocialConnect();
      return socket;
    }

    const opts = { transports: ["websocket", "polling"], reconnection: true };
    socket = config.wsUrl ? io(config.wsUrl, opts) : io(opts);

    socket.on("connect", () => {
      emitSocialConnect();
    });

    socket.on("social:connected", () => {
      connected = true;
      connectHandlers.forEach((fn) => fn());
    });

    socket.on("disconnect", () => {
      connected = false;
    });

    socket.on("connect_error", () => {
      connected = false;
    });

    socket.on("chat:message", (msg) => {
      chatHandlers.forEach((fn) => fn(msg));
    });

    socket.on("group:message", (msg) => {
      groupChatHandlers.forEach((fn) => fn(msg));
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

    socket.on("notification:new", (data) => {
      notificationHandlers.forEach((fn) => fn(data));
    });

    return socket;
  }

  function onInvite(fn) {
    inviteHandlers.push(fn);
  }

  function onFriendRequest(fn) {
    friendRequestHandlers.push(fn);
  }

  function onNotification(fn) {
    notificationHandlers.push(fn);
  }

  function onChat(fn) {
    chatHandlers.push(fn);
  }

  function onGroupChat(fn) {
    groupChatHandlers.push(fn);
  }

  function onPresence(fn) {
    presenceHandlers.push(fn);
  }

  function onConnected(fn) {
    connectHandlers.push(fn);
    if (connected) fn();
  }

  function sendChat(toUserId, body) {
    if (!socket?.connected) {
      connect();
      return;
    }
    socket.emit("chat:send", { toUserId, body });
  }

  function sendGroupChat(groupId, body) {
    if (!socket?.connected) {
      connect();
      return;
    }
    socket.emit("group:send", { groupId, body });
  }

  function inviteToSession(friendUserId) {
    if (!socket?.connected) {
      connect();
      return;
    }
    socket.emit("session:invite", { friendUserId });
  }

  function inviteGroupToSession(groupId) {
    if (!socket?.connected) {
      connect();
      return;
    }
    socket.emit("session:invite_group", { groupId });
  }

  window.BunkerSocial = {
    connect,
    onInvite,
    onFriendRequest,
    onNotification,
    onChat,
    onGroupChat,
    onPresence,
    onConnected,
    sendChat,
    sendGroupChat,
    inviteToSession,
    inviteGroupToSession,
    isConnected: () => connected,
  };
})();
