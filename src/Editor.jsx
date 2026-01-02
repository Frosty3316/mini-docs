import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

export default function Editor() {
  const [title, setTitle] = useState("Untitled document");
  const [content, setContent] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Saved locally");
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [typing, setTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);

  const editorRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  const wordCount =
    content.trim() === ""
      ? 0
      : content.trim().split(/\s+/).length;

  useEffect(() => {
  socket.on("connect", () => {
    setConnected(true);
    setStatus("Connected");
  });

  socket.on("typing", (id) => {
  setTypingUser(id);
  setTimeout(() => setTypingUser(null), 1000);
});

  socket.on("typing", (id) => {
  setTyping(true);

  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.classList.add("typing");
    setTimeout(() => el.classList.remove("typing"), 600);
  }

  clearTimeout(window.__typingTimeout);
  window.__typingTimeout = setTimeout(() => {
      setTyping(false);
    }, 800);
  });

  socket.on("cursor", (cursor) => {
    setCursors((prev) => ({
      ...prev,
      [cursor.id]: cursor,
    }));
  });

  socket.on("disconnect", () => {
    setConnected(false);
    setStatus("Disconnected");
  });

  socket.on("presence", (userList) => {
    console.log("PRESENCE EVENT:", userList);
    setUsers(userList);
  });

  socket.on("document", (data) => {
    isRemoteUpdate.current = true;
    setContent(data);

    if (editorRef.current) {
      editorRef.current.textContent = data;
      editorRef.current.classList.add("remote-update");
      setTimeout(() => {
        editorRef.current.classList.remove("remote-update");
      }, 200);
    }

    setStatus("Synced");
  });

  return () => {
    socket.off("connect");
    socket.off("disconnect");
    socket.off("presence");  
    socket.off("document");
  };
}, []);

  function handleMouseMove(e) {
    socket.emit("cursor", {
      x: e.clientX,
      y: e.clientY,
    });
  }

  function handleInput(e) {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const text = e.currentTarget.textContent;
    setContent(text);
    setStatus("Live editing…");


    socket.emit("edit", text);
    socket.emit("typing");
  }

  console.log("USERS STATE:", users);
  return (
  <div className="editor-container">
    <div className="editor-header">
  <input
    className="editor-title"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
  />

{Object.values(cursors).map((c) => (
  <div
    key={c.id}
    className="remote-cursor"
    style={{
      left: c.x,
      top: c.y,
      background: c.color,
    }}
  />
))}

  <div className="header-right">
    <div className="avatars">
  {users.map((user, i) => (
    <span
      key={user.id}
      data-id={user.id}
      className="avatar"
      style={{ background: user.color }}
      title={`User ${i + 1}`}
    />
  ))}
</div>

    <div className="status">
      <span className={`dot ${connected ? "online" : "offline"}`} />
      {typingUser && (
  <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
    Someone is typing…
  </span>
)}
    </div>
  </div>
</div>

    <div
      ref={editorRef}
      className="editor"
      contentEditable
      onInput={handleInput}
      onMouseMove={handleMouseMove}
      suppressContentEditableWarning
    />

    <div className="editor-footer">
      <span>{wordCount} words</span>
      <span>{content.length} characters</span>
    </div>
  </div>
);
}