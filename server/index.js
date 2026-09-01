import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_CONTENT = 200_000;
const MAX_TITLE = 80;
const EDIT_PER_SEC = 30;
const CURSOR_PER_SEC = 20;
const TYPING_PER_SEC = 8;

const SYMBOLS = ["◆", "●", "■", "▲", "✦", "⬟", "⬢", "⬣"];
const COLORS = ["#38bdf8", "#f472b6", "#34d399", "#facc15", "#a78bfa"];

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://inkroom-swart.vercel.app",
  "https://inkroom.vercel.app",
]);

for (const origin of (process.env.CLIENT_ORIGIN || "").split(",")) {
  const trimmed = origin.trim();
  if (trimmed) allowedOrigins.add(trimmed);
}

function originAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      callback(null, originAllowed(origin));
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      callback(null, originAllowed(origin));
    },
    methods: ["GET", "POST"],
  },
});

const documents = {};
const users = {};
const rateBuckets = new Map();

function isDocId(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

function inRoom(socket, docId) {
  return Boolean(docId && users[socket.id]?.docId === docId);
}

function rateOk(socketId, key, maxPerSec) {
  const now = Date.now();
  const bucketKey = `${socketId}:${key}`;
  let bucket = rateBuckets.get(bucketKey);
  if (!bucket || now - bucket.start >= 1000) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(bucketKey, bucket);
  }
  bucket.count += 1;
  return bucket.count <= maxPerSec;
}

function clearRates(socketId) {
  for (const key of rateBuckets.keys()) {
    if (key.startsWith(`${socketId}:`)) rateBuckets.delete(key);
  }
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function roomUsers(docId) {
  return Object.values(users).filter((user) => user.docId === docId);
}

function emitPresence(docId) {
  io.to(docId).emit("presence", roomUsers(docId));
}

function asDoc(value) {
  if (typeof value === "string") {
    return { title: "Untitled", content: value };
  }
  return value || { title: "Untitled", content: "" };
}

function listDocs() {
  return Object.entries(documents).map(([id, value]) => {
    const doc = asDoc(value);
    return { id, title: doc.title || "Untitled" };
  });
}

function emitDocList() {
  io.emit("documents-updated", listDocs());
}

io.on("connection", (socket) => {
  users[socket.id] = {
    id: socket.id,
    color: randomFrom(COLORS),
    symbol: randomFrom(SYMBOLS),
    label: `User ${Object.keys(users).length + 1}`,
    docId: null,
  };

  socket.emit("documents-updated", listDocs());

  socket.on("join-document", (docId) => {
    if (!isDocId(docId) || !users[socket.id]) return;

    const previous = users[socket.id].docId;
    if (previous) socket.leave(previous);

    users[socket.id].docId = docId;
    socket.join(docId);

    let created = false;
    if (!Object.prototype.hasOwnProperty.call(documents, docId)) {
      documents[docId] = { title: "Untitled", content: "" };
      created = true;
    } else {
      documents[docId] = asDoc(documents[docId]);
    }

    const doc = documents[docId];
    socket.emit("document", { content: doc.content, title: doc.title });
    emitPresence(docId);

    if (previous && previous !== docId) emitPresence(previous);
    if (created) emitDocList();
  });

  socket.on("edit", (payload = {}) => {
    const { docId, content } = payload;
    if (!isDocId(docId) || !inRoom(socket, docId)) return;
    if (typeof content !== "string" || content.length > MAX_CONTENT) return;
    if (!rateOk(socket.id, "edit", EDIT_PER_SEC)) return;

    documents[docId] = asDoc(documents[docId]);
    documents[docId].content = content;
    socket.to(docId).emit("document", {
      content,
      title: documents[docId].title,
    });
  });

  socket.on("rename-document", (payload = {}) => {
    const { docId, title } = payload;
    if (!isDocId(docId) || !inRoom(socket, docId)) return;
    if (typeof title !== "string") return;
    if (!rateOk(socket.id, "rename", 10)) return;

    const next = title.trim().slice(0, MAX_TITLE) || "Untitled";
    documents[docId] = asDoc(documents[docId]);
    documents[docId].title = next;
    emitDocList();
    socket.to(docId).emit("document-meta", { docId, title: next });
  });

  socket.on("typing", (payload = {}) => {
    const { docId } = payload;
    if (!isDocId(docId) || !inRoom(socket, docId)) return;
    if (!rateOk(socket.id, "typing", TYPING_PER_SEC)) return;

    socket.to(docId).emit("typing", { userId: socket.id });
  });

  socket.on("cursor", (payload = {}) => {
    const { docId, x, y } = payload;
    if (!isDocId(docId) || !inRoom(socket, docId)) return;
    if (!rateOk(socket.id, "cursor", CURSOR_PER_SEC)) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    socket.to(docId).emit("cursor", {
      id: socket.id,
      x: Math.min(Math.max(x, -2000), 8000),
      y: Math.min(Math.max(y, -2000), 8000),
      color: users[socket.id]?.color,
    });
  });

  socket.on("delete-document", (docId) => {
    if (!isDocId(docId)) return;
    if (!rateOk(socket.id, "delete", 5)) return;
    if (!Object.prototype.hasOwnProperty.call(documents, docId)) return;

    delete documents[docId];

    for (const user of Object.values(users)) {
      if (user.docId === docId) user.docId = null;
    }

    io.to(docId).emit("document-deleted", docId);
    io.in(docId).socketsLeave(docId);
    emitDocList();
  });

  socket.on("disconnect", () => {
    const docId = users[socket.id]?.docId;
    delete users[socket.id];
    clearRates(socket.id);
    if (docId) emitPresence(docId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
