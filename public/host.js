const socket = io();

socket.on("playersUpdate", (players) => {
  renderPlayers(players);
});

socket.on("cardOpened", ({ playerId, cardIndex }) => {
  showCardOnScreen(playerId, cardIndex);
});
