import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const SYMBOLS = ["◆", "●", "■", "▲", "✦", "⬟", "⬢", "⬣"];

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function Editor() {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Idle");

  const [users, setUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [cursors, setCursors] = useState({});

  const [docs, setDocs] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);

  const editorRef = useRef(null);
  const isRemoteUpdate = useRef(false);

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
      setDocs(
        ids.map((id, i) => ({
          id,
          title: `Doc ${i + 1}`,
        }))
      );
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

        {/* EDITOR CONTAINER — ALWAYS PRESENT */}
        <div className="editor-container">

          {/* HEADER (RESTORED) */}
          <div className="editor-header">
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
            </div>
          </div>

          {/* EMPTY STATE */}
          {!activeDoc && (
            <div className="empty-state">
              <p>Create a document to start collaborating</p>
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
                suppressContentEditableWarning
              />
            </>
          )}

          {/* FOOTER (RESTORED) */}
          <div className="editor-footer">
            <span>{content.split(/\s+/).filter(Boolean).length} words</span>
            <span>{content.length} characters</span>
          </div>

        </div>
      </div>
    </div>
  );
}