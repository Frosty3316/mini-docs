import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const documents = {};
const users = {};

function randomColor() {
  const colors = ["#38bdf8", "#f472b6", "#34d399", "#facc15", "#a78bfa"];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  users[socket.id] = {
    id: socket.id,
    color: randomColor(),
    label: `User ${Object.keys(users).length + 1}`,
    docId: null,
  };

  // ✅ CRITICAL FIX:
  // Tell the client about existing documents immediately on connect
  socket.emit("documents-updated", Object.keys(documents));

  socket.on("join-document", (docId) => {
    if (users[socket.id].docId) {
      socket.leave(users[socket.id].docId);
    }

    users[socket.id].docId = docId;
    socket.join(docId);

    if (!documents[docId]) {
      documents[docId] = "";
    }

    socket.emit("document", documents[docId]);

    const roomUsers = Object.values(users).filter(
      (u) => u.docId === docId
    );

    io.to(docId).emit("presence", roomUsers);

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
      color: users[socket.id]?.color,
    });
  });

  socket.on("delete-document", (docId) => {
    delete documents[docId];

    Object.values(users).forEach((u) => {
      if (u.docId === docId) {
        u.docId = null;
      }
    });

    io.emit("documents-updated", Object.keys(documents));
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const docId = users[socket.id]?.docId;
    delete users[socket.id];

    if (docId) {
      const roomUsers = Object.values(users).filter(
        (u) => u.docId === docId
      );
      io.to(docId).emit("presence", roomUsers);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});