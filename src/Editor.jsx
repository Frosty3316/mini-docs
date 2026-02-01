import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const SYMBOLS = ["◆", "●", "■", "▲", "✦", "⬟", "⬢", "⬣"];

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function Editor() {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Idle");
  const [theme, setTheme] = useState("dark");

  const [users, setUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [cursors, setCursors] = useState({});

  const [docs, setDocs] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);

  const editorRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  /* ---------- THEME ---------- */

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "light") {
      root.style.setProperty("--bg", "#f8fafc");
      root.style.setProperty("--surface", "#ffffff");
      root.style.setProperty("--border", "#e2e8f0");
      root.style.setProperty("--text", "#020617");
      root.style.setProperty("--muted", "#475569");
    } else {
      root.style.setProperty("--bg", "#020617");
      root.style.setProperty("--surface", "#0f172a");
      root.style.setProperty("--border", "#334155");
      root.style.setProperty("--text", "#e5e7eb");
      root.style.setProperty("--muted", "#94a3b8");
    }
  }, [theme]);

  /* ---------- SOCKET ---------- */

  useEffect(() => {
    socket.on("presence", (u) => {
      setUsers(
        u.map((user) => ({
          ...user,
          symbol: user.symbol || randomSymbol(),
        }))
      );
    });

    socket.on("documents-updated", (ids) => {
      setDocs(ids.map((id, i) => ({ id, title: `Doc ${i + 1}` })));
    });

    socket.on("document", (data) => {
      isRemoteUpdate.current = true;
      setContent(data);
      if (editorRef.current) editorRef.current.textContent = data;
      setStatus("Synced");
    });

    socket.on("typing", ({ userId }) => {
      setTypingUser(userId);
      setTimeout(() => setTypingUser(null), 1200);
    });

    socket.on("cursor", (c) => {
      setCursors((prev) => ({ ...prev, [c.id]: c }));
    });

    return () => socket.off();
  }, []);

  /* ---------- JOIN DOC ---------- */

  useEffect(() => {
    if (!activeDoc) return;
    socket.emit("join-document", activeDoc);
    setContent("");
    if (editorRef.current) editorRef.current.textContent = "";
  }, [activeDoc]);

  /* ---------- INPUT ---------- */

  function handleInput(e) {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const text = e.currentTarget.textContent;
    setContent(text);
    setStatus("Editing…");

    socket.emit("edit", { docId: activeDoc, content: text });
    socket.emit("typing", { docId: activeDoc });
  }

  function handleMouseMove(e) {
    if (!activeDoc) return;
    socket.emit("cursor", {
      docId: activeDoc,
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
    });
  }

  /* ---------- RENDER ---------- */

  return (
    <div className="docs-app">
      <div className="docs-shell">

        {/* DOC TABS */}
        <div className="docs-tabs">
          {docs.map((doc) => (
            <button
              key={doc.id}
              className={`doc-tab ${doc.id === activeDoc ? "active" : ""}`}
              onClick={() => setActiveDoc(doc.id)}
            >
              {doc.title}
              <span
                className="delete-doc"
                onClick={(e) => {
                  e.stopPropagation();
                  socket.emit("delete-document", doc.id);
                }}
              >
                ✕
              </span>
            </button>
          ))}
          <button
            className="doc-tab add"
            onClick={() => {
              const id = crypto.randomUUID();
              setActiveDoc(id);
              socket.emit("join-document", id);
            }}
          >
            ＋
          </button>
        </div>

        <div className="editor-container">

          {/* HEADER */}
          <div className="editor-header">
            <div /> {/* left spacer */}

            <div className="status">
              <span>
                {typingUser ? "Someone is typing…" : status}
              </span>

              <div className="avatars-inline">
                {users.map((u) => (
                  <span
                    key={u.id}
                    className="avatar"
                    style={{ background: u.color }}
                    title={u.label}
                  >
                    {u.symbol}
                  </span>
                ))}
              </div>

              <button
                className={`theme-toggle ${theme}`}
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
              >
                <span className="theme-icon">
                  {theme === "dark" ? "☀" : "🌙"}
                </span>
              </button>
            </div>
          </div>

          {/* EMPTY STATE */}
          {!activeDoc && (
            <div className="empty-state">
              <p>Create or join a document to start collaborating</p>
            </div>
          )}

          {/* EDITOR */}
          {activeDoc && (
            <>
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

              <div
                ref={editorRef}
                className="editor"
                contentEditable
                onInput={handleInput}
                onMouseMove={handleMouseMove}
                suppressContentEditableWarning
              />
            </>
          )}

          {/* FOOTER */}
          <div className="editor-footer">
            <span>{content.split(/\s+/).filter(Boolean).length} words</span>
            <span>{content.length} characters</span>
          </div>

        </div>
      </div>
    </div>
  );
}