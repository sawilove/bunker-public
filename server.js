const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Маршрут для ведущего
app.get("/host", (req, res) => {
  res.sendFile(__dirname + "/public/host.html");
});

// Маршрут для игрока
app.get("/player", (req, res) => {
  res.sendFile(__dirname + "/public/player.html");
});

let players = {};

io.on("connection", (socket) => {
  console.log("Игрок подключился:", socket.id);

  socket.on("join", (name) => {
    players[socket.id] = {
      name,
      cards: ["Профессия", "Возраст", "Хобби", "Фобия"],
      opened: []
    };
    io.emit("playersUpdate", players);
  });

  socket.on("openCard", (index) => {
    players[socket.id].opened.push(index);
    io.emit("cardOpened", { playerId: socket.id, index });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playersUpdate", players);
  });
});

http.listen(3000, () => {
  console.log("Server running on port 3000");
});
