const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let documentContent = "";
const users = {}; 

io.on("connection", (socket) => {
  console.log("User connected");

  // assign random color to user
  const userColor = `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;
  const userNumber = Object.keys(users).length + 1;

users[socket.id] = {
  id: socket.id,
  color: userColor,
  label: `User ${userNumber}`,
};

  // send presence update to everyone
  io.emit("presence", Object.values(users));
  console.log("EMITTING PRESENCE:", users);

  // send current document to new user
  socket.emit("document", documentContent);

  // receive edits
  socket.on("edit", (content) => {
    documentContent = content;
    socket.broadcast.emit("document", documentContent);
  });

  socket.on("typing", () => {
  socket.broadcast.emit("typing", socket.id);
  });

  socket.on("cursor", (pos) => {
    socket.broadcast.emit("cursor", {
      id: socket.id,
      ...pos,
      color: users[socket.id]?.color,
    });
  });


  // handle disconnect
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("presence", Object.values(users));
    console.log("Presence users:", Object.values(users));
    console.log("User disconnected");
  });
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});