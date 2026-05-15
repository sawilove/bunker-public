const socket = io();

function joinGame() {
  const name = prompt("Ваше имя:");
  socket.emit("join", name);
}

function openCard(i) {
  socket.emit("openCard", i);
}
