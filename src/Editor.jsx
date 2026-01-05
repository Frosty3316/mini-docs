import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const SYMBOLS = ["◆", "●", "■", "▲", "✦", "⬟", "⬢", "⬣"];

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function Editor() {
  const [title, setTitle] = useState("Untitled document");
  const [content, setContent] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Saved");

  const [users, setUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [cursors, setCursors] = useState({});

  const [docs, setDocs] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);

  const [theme, setTheme] = useState("dark");
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

  const [search, setSearch] = useState("");

  const editorRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  /* ---------- SOCKET ---------- */

  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      setStatus("Synced");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setStatus("Disconnected");
    });

    socket.on("presence", (u) => {
      const enriched = u.map((user) => ({
        ...user,
        symbol: user.symbol || randomSymbol(),
      }));
      setUsers(enriched);
    });

    socket.on("documents-updated", (ids) => {
      const mapped = ids.map((id, i) => ({
        id,
        title: `Doc ${i + 1}`,
      }));

      setDocs(mapped);

      if (!activeDoc && mapped.length) {
        setActiveDoc(mapped[0].id);
      }

      if (activeDoc && !ids.includes(activeDoc)) {
        setActiveDoc(mapped[0]?.id || null);
      }
    });

    socket.on("document", (data) => {
      isRemoteUpdate.current = true;
      setContent(data);
      if (editorRef.current) {
        editorRef.current.textContent = data;
        editorRef.current.classList.add("remote-update");
        setTimeout(() => {
          editorRef.current?.classList.remove("remote-update");
        }, 200);
      }
      setStatus("Synced");
    });

    socket.on("typing", ({ userId }) => {
      setTypingUser(userId);
      setTimeout(() => setTypingUser(null), 1200);
    });

    socket.on("cursor", (c) => {
      setCursors(prev => ({ ...prev, [c.id]: c }));
    });

    return () => socket.off();
  }, [activeDoc]);

  useEffect(() => {
    if (!activeDoc) return;

    socket.emit("join-document", activeDoc);
    setContent("");
    if (editorRef.current) editorRef.current.textContent = "";
  }, [activeDoc]);

  /* ---------- AUTOSAVE FEEL ---------- */

  useEffect(() => {
    if (!content) return;
    const t = setTimeout(() => setStatus("Saved"), 700);
    return () => clearTimeout(t);
  }, [content]);

  /* ---------- CTRL + F ---------- */

  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        const q = prompt("Find in document:");
        if (!q) return;
        setSearch(q);
        highlight(q);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function highlight(q) {
    if (!editorRef.current) return;
    const text = editorRef.current.textContent;
    const regex = new RegExp(`(${q})`, "gi");
    editorRef.current.innerHTML = text.replace(
      regex,
      `<mark>$1</mark>`
    );
  }

  /* ---------- INPUT ---------- */

  function handleInput(e) {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const text = e.currentTarget.textContent;
    setContent(text);
    setStatus("Live editing…");

    socket.emit("edit", { docId: activeDoc, content: text });
    socket.emit("typing", { docId: activeDoc });
  }

  function handleMouseMove(e) {
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
            onClick={() => socket.emit("join-document", crypto.randomUUID())}
          >
            ＋
          </button>

          <button
  className={`theme-toggle ${theme}`}
  onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
  aria-label="Toggle theme"
>
  <span className="theme-icon">
    {theme === "dark" ? "☀" : "🌙"}
  </span>
</button>
        </div>

        {/* EDITOR */}
        <div className="editor-container">
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
          <div className="editor-header">
            <div className="editor-title"
                 contentEditable
                 suppressContentEditableWarning
                 onInput={(e) => setTitle(e.currentTarget.textContent)}
            >
                 {title}
              </div>


            <div className="header-right">
              <div className="status">
                <span className={`dot ${connected ? "online" : "offline"}`} />
                <span>
                  {typingUser
                    ? `${users.find(u => u.id === typingUser)?.label || "Someone"} is typing…`
                    : status}
                </span>

                {/* AVATARS NEXT TO STATUS */}
                <div className="avatars-inline">
                  {users.map((u) => (
                    <div key={u.id} className="avatar-wrapper">
                      <span
                        className={`avatar ${typingUser === u.id ? "typing" : ""}`}
                        style={{ background: u.color }}
                      >
                        {u.symbol}
                      </span>
                      <span className="avatar-label">{u.label}</span>
                    </div>
                  ))}
                </div>
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
            <span>{content.split(/\s+/).filter(Boolean).length} words</span>
            <span>{content.length} characters</span>
          </div>
        </div>
      </div>
    </div>
  );
}