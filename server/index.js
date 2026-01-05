const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

/* -------- STATE -------- */

const documents = {}; // { docId: content }
const users = {};     // { socketId: { id, color, label, docId } }

/* -------- SOCKET -------- */

io.on("connection", (socket) => {
  const color = `hsl(${Math.floor(Math.random() * 360)},70%,60%)`;
  const label = `User ${Object.keys(users).length + 1}`;

  users[socket.id] = {
    id: socket.id,
    color,
    label,
    docId: null,
  };

  socket.on("join-document", (docId) => {
    const prev = users[socket.id].docId;

    if (prev) {
      socket.leave(prev);
      emitPresence(prev);
    }

    socket.join(docId);
    users[socket.id].docId = docId;

    if (!documents[docId]) documents[docId] = "";

    socket.emit("document", documents[docId]);
    emitPresence(docId);
    io.emit("documents-updated", Object.keys(documents));
  });

  socket.on("edit", ({ docId, content }) => {
    documents[docId] = content;
    socket.to(docId).emit("document", content);
  });

  socket.on("typing", ({ docId }) => {
    socket.to(docId).emit("typing", { userId: socket.id });
  });

  socket.on("cursor", ({ docId, x, y }) => {
    socket.to(docId).emit("cursor", {
      id: socket.id,
      x,
      y,
      color: users[socket.id].color,
    });
  });

  socket.on("delete-document", (docId) => {
    delete documents[docId];

    Object.values(users).forEach((u) => {
      if (u.docId === docId) u.docId = null;
    });

    io.emit("documents-updated", Object.keys(documents));
  });

  socket.on("disconnect", () => {
    const docId = users[socket.id]?.docId;
    delete users[socket.id];
    if (docId) emitPresence(docId);
  });
});

/* -------- HELPERS -------- */

function emitPresence(docId) {
  const present = Object.values(users).filter(u => u.docId === docId);
  io.to(docId).emit("presence", present);
}

/* -------- START -------- */

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});