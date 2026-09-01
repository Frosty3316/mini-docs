import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "./components/Logo";
import { Toolbar } from "./components/Toolbar";
import { useTheme } from "./hooks/useTheme";
import { docIdFromPath, setDocPath, shareUrl } from "./lib/path";
import {
  applyHighlights,
  clearHighlights,
  findMatches,
  scrollMatchIntoView,
} from "./lib/search";
import { debounce, throttle } from "./lib/timing";
import { socket } from "./socket";

function normalizeDocs(payload) {
  if (!Array.isArray(payload)) return [];
  return payload.map((item) =>
    typeof item === "string"
      ? { id: item, title: "Untitled" }
      : { id: item.id, title: item.title || "Untitled" }
  );
}

function isEmptyHtml(html) {
  if (!html) return true;
  return html.replace(/<[^>]+>/g, "").trim() === "";
}

function plainText(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 13.5A7 7 0 1 1 10.5 8 5.5 5.5 0 0 0 16 13.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Editor() {
  const { theme, toggleTheme } = useTheme();

  const [content, setContent] = useState("");
  const [docTitle, setDocTitle] = useState("Untitled");
  const [status, setStatus] = useState("Live");
  const [connection, setConnection] = useState(
    socket.connected ? "connected" : "connecting"
  );
  const [shareNote, setShareNote] = useState("");
  const [toolbarTick, setToolbarTick] = useState(0);

  const [users, setUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [cursors, setCursors] = useState({});

  const [docs, setDocs] = useState([]);
  const [activeDoc, setActiveDoc] = useState(() => docIdFromPath());
  const [railOpen, setRailOpen] = useState(false);

  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);

  const findInputRef = useRef(null);
  const matchesRef = useRef([]);
  const typingTimeoutRef = useRef(0);
  const activeDocRef = useRef(activeDoc);
  const applyingRemote = useRef(false);
  const cacheRef = useRef({});

  const emitEdit = useMemo(
    () =>
      debounce((payload) => {
        socket.emit("edit", payload);
      }, 150),
    []
  );

  const emitTyping = useMemo(
    () =>
      debounce((payload) => {
        socket.emit("typing", payload);
      }, 400),
    []
  );

  const emitCursor = useMemo(
    () =>
      throttle((payload) => {
        socket.emit("cursor", payload);
      }, 70),
    []
  );

  const emitRename = useMemo(
    () =>
      debounce((payload) => {
        socket.emit("rename-document", payload);
      }, 250),
    []
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      FontSize,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    editorProps: {
      attributes: { class: "editor", spellcheck: "true" },
    },
    onUpdate: ({ editor: instance }) => {
      if (applyingRemote.current) return;
      const html = instance.getHTML();
      const id = activeDocRef.current;
      setContent(html);
      setStatus("Editing…");
      if (!id) return;
      cacheRef.current[id] = {
        ...(cacheRef.current[id] || {}),
        html,
      };
      emitEdit({ docId: id, content: html });
      emitTyping({ docId: id });
    },
    onSelectionUpdate: () => setToolbarTick((n) => n + 1),
    onTransaction: () => setToolbarTick((n) => n + 1),
  });

  useEffect(() => {
    activeDocRef.current = activeDoc;
  }, [activeDoc]);

  useEffect(() => {
    return () => {
      emitEdit.cancel();
      emitTyping.cancel();
      emitCursor.cancel();
      emitRename.cancel();
    };
  }, [emitCursor, emitEdit, emitRename, emitTyping]);

  useEffect(() => {
    const onConnect = () => {
      setConnection("connected");
      if (activeDocRef.current) {
        socket.emit("join-document", activeDocRef.current);
      }
    };
    const onDisconnect = () => setConnection("connecting");
    const onError = () => setConnection("error");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    socket.io.on("reconnect_failed", onError);

    if (socket.connected) setConnection("connected");
    else if (!socket.active) socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.io.off("reconnect_failed", onError);
    };
  }, []);

  useEffect(() => {
    const onPresence = (roomUsers) => {
      setUsers(Array.isArray(roomUsers) ? roomUsers : []);
      setCursors((prev) => {
        const live = new Set((roomUsers || []).map((user) => user.id));
        const next = {};
        for (const [id, cursor] of Object.entries(prev)) {
          if (live.has(id)) next[id] = cursor;
        }
        return next;
      });
    };

    const onDocumentsUpdated = (payload) => {
      const incoming = normalizeDocs(payload);
      setDocs((prev) => {
        const seen = new Set(incoming.map((doc) => doc.id));
        const pending = prev.filter((doc) => doc.local && !seen.has(doc.id));
        return [...incoming, ...pending];
      });
    };

    const onDocument = (data) => {
      const html = typeof data === "string" ? data : (data?.content ?? "");
      const title = typeof data === "object" && data?.title ? data.title : null;
      const id = activeDocRef.current;
      const cached = id ? cacheRef.current[id] : null;

      if (title) setDocTitle(title);

      if (isEmptyHtml(html) && cached?.html && !isEmptyHtml(cached.html)) {
        socket.emit("edit", { docId: id, content: cached.html });
        return;
      }

      if (editor && editor.getHTML() === html) {
        setContent(html);
        setStatus("Synced");
        return;
      }

      if (id) {
        cacheRef.current[id] = {
          ...(cacheRef.current[id] || {}),
          html,
          title: title || cacheRef.current[id]?.title,
        };
      }

      applyingRemote.current = true;
      editor?.commands.setContent(html || "<p></p>", { emitUpdate: false });
      applyingRemote.current = false;
      setContent(html);
      setStatus("Synced");
    };

    const onTyping = ({ userId } = {}) => {
      setTypingUser(userId || "someone");
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 1200);
    };

    const onCursor = (cursor) => {
      if (!cursor?.id) return;
      setCursors((prev) => ({ ...prev, [cursor.id]: cursor }));
    };

    const onMeta = ({ docId, title } = {}) => {
      if (!title) return;
      setDocs((prev) =>
        prev.map((doc) => (doc.id === docId ? { ...doc, title } : doc))
      );
      if (activeDocRef.current === docId) setDocTitle(title);
    };

    const onDeleted = (docId) => {
      setDocs((prev) => prev.filter((doc) => doc.id !== docId));
      delete cacheRef.current[docId];
      if (activeDocRef.current === docId) {
        setActiveDoc(null);
        setDocPath(null);
        setContent("");
        setDocTitle("Untitled");
        setCursors({});
        setUsers([]);
        applyingRemote.current = true;
        editor?.commands.clearContent({ emitUpdate: false });
        applyingRemote.current = false;
      }
    };

    socket.on("presence", onPresence);
    socket.on("documents-updated", onDocumentsUpdated);
    socket.on("document", onDocument);
    socket.on("typing", onTyping);
    socket.on("cursor", onCursor);
    socket.on("document-meta", onMeta);
    socket.on("document-deleted", onDeleted);

    return () => {
      socket.off("presence", onPresence);
      socket.off("documents-updated", onDocumentsUpdated);
      socket.off("document", onDocument);
      socket.off("typing", onTyping);
      socket.off("cursor", onCursor);
      socket.off("document-meta", onMeta);
      socket.off("document-deleted", onDeleted);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [editor]);

  useEffect(() => {
    emitEdit.flush();
    emitTyping.cancel();
    emitRename.flush();
    setCursors({});
    setTypingUser(null);
    setFindOpen(false);
    setQuery("");
    clearHighlights();
    setRailOpen(false);

    if (!activeDoc) {
      setContent("");
      setDocTitle("Untitled");
      applyingRemote.current = true;
      editor?.commands.clearContent(false);
      applyingRemote.current = false;
      setDocPath(null);
      return;
    }

    setDocPath(activeDoc);
    const cached = cacheRef.current[activeDoc];
    const known = docs.find((doc) => doc.id === activeDoc);
    setDocTitle(cached?.title || known?.title || "Untitled");

    if (cached?.html) {
      applyingRemote.current = true;
      editor?.commands.setContent(cached.html, { emitUpdate: false });
      applyingRemote.current = false;
      setContent(cached.html);
    } else {
      applyingRemote.current = true;
      editor?.commands.clearContent(false);
      applyingRemote.current = false;
      setContent("");
      setStatus("Loading…");
    }

    socket.emit("join-document", activeDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc, editor, emitEdit, emitRename, emitTyping]);

  useEffect(() => {
    function onPop() {
      setActiveDoc(docIdFromPath());
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!findOpen || !editor) {
      clearHighlights();
      matchesRef.current = [];
      setMatchCount(0);
      return;
    }

    const root = editor.view.dom;
    const needle = query.trim();
    if (!needle) {
      clearHighlights();
      matchesRef.current = [];
      setMatchCount(0);
      return;
    }

    const matches = findMatches(root, needle);
    matchesRef.current = matches;
    setMatchCount(matches.length);
    const index = matches.length ? Math.min(activeMatch, matches.length - 1) : 0;
    applyHighlights(matches, matches.length ? index : -1);
    if (matches[index]) scrollMatchIntoView(matches[index], root);
  }, [findOpen, query, content, activeMatch, activeDoc, editor]);

  useEffect(() => {
    if (findOpen) findInputRef.current?.focus();
  }, [findOpen]);

  useEffect(() => {
    function onKeyDown(event) {
      const combo = event.ctrlKey || event.metaKey;
      if (combo && event.key.toLowerCase() === "f") {
        if (!activeDocRef.current) return;
        event.preventDefault();
        setFindOpen(true);
        findInputRef.current?.select();
        return;
      }
      if (event.key === "Escape" && findOpen) {
        event.preventDefault();
        closeFind();
        return;
      }
      if (!findOpen) return;
      if (event.key === "F3" || (combo && event.key.toLowerCase() === "g")) {
        event.preventDefault();
        if (event.shiftKey) goPrev();
        else goNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [findOpen]);

  function closeFind() {
    setFindOpen(false);
    setQuery("");
    setActiveMatch(0);
    clearHighlights();
    editor?.commands.focus();
  }

  function goNext() {
    const n = matchesRef.current.length;
    if (!n) return;
    setActiveMatch((i) => (i + 1) % n);
  }

  function goPrev() {
    const n = matchesRef.current.length;
    if (!n) return;
    setActiveMatch((i) => (i - 1 + n) % n);
  }

  function snapshotCurrent() {
    const id = activeDocRef.current;
    if (!id || !editor) return;
    cacheRef.current[id] = {
      title: docTitle,
      html: editor.getHTML(),
    };
    emitEdit.flush();
    emitRename.flush();
  }

  function openDoc(id) {
    snapshotCurrent();
    setActiveDoc(id);
  }

  function handleTitleChange(event) {
    const title = event.target.value;
    setDocTitle(title);
    if (!activeDoc) return;
    cacheRef.current[activeDoc] = {
      ...(cacheRef.current[activeDoc] || {}),
      title,
    };
    setDocs((prev) =>
      prev.map((doc) => (doc.id === activeDoc ? { ...doc, title } : doc))
    );
    emitRename({ docId: activeDoc, title });
  }

  function handleBlur() {
    emitEdit.flush();
    emitRename.flush();
  }

  function handleMouseMove(event) {
    if (!activeDoc) return;
    const wrap = event.currentTarget;
    const rect = wrap.getBoundingClientRect();
    emitCursor({
      docId: activeDoc,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  function createDoc() {
    snapshotCurrent();
    const id = crypto.randomUUID();
    cacheRef.current[id] = { title: "Untitled", html: "" };
    setDocs((prev) => {
      if (prev.some((doc) => doc.id === id)) return prev;
      return [{ id, title: "Untitled", local: true }, ...prev];
    });
    setActiveDoc(id);
  }

  function deleteDoc(event, docId) {
    event.stopPropagation();
    if (!window.confirm("Delete this page for everyone in the room?")) return;
    socket.emit("delete-document", docId);
    setDocs((prev) => prev.filter((doc) => doc.id !== docId));
    delete cacheRef.current[docId];
    if (docId === activeDoc) {
      setActiveDoc(null);
      setDocPath(null);
    }
  }

  async function copyShareLink() {
    if (!activeDoc) return;
    const url = shareUrl(activeDoc);
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      window.prompt("Copy this invite link", url);
      setShareNote("Copy the link to invite someone");
    }
    window.setTimeout(() => setShareNote(""), 2200);
  }

  function retryConnect() {
    setConnection("connecting");
    socket.connect();
  }

  const typingLabel = typingUser
    ? users.find((user) => user.id === typingUser)?.label || "Someone"
    : null;

  const connectionLabel =
    connection === "connected"
      ? "Live"
      : connection === "error"
        ? "Reconnect failed"
        : "Connecting…";

  const statusLabel = typingLabel
    ? `${typingLabel} is typing…`
    : connection !== "connected"
      ? connectionLabel
      : status === "Idle"
        ? "Live"
        : status;

  const matchLabel =
    matchCount === 0
      ? "No matches"
      : `${Math.min(activeMatch, Math.max(matchCount - 1, 0)) + 1} of ${matchCount}`;

  const words = plainText(content).split(/\s+/).filter(Boolean).length;
  void toolbarTick;

  return (
    <div className={`app ${railOpen ? "rail-open" : ""}`}>
      <aside className="rail">
        <button type="button" className="brand" onClick={() => openDoc(null)}>
          <Logo />
          <div>
            <div className="brand-name">Inkroom</div>
            <span className="brand-tag">Write together</span>
          </div>
        </button>

        <button type="button" className="new-doc" onClick={createDoc}>
          New page
        </button>

        <nav className="doc-list" aria-label="Pages">
          <div className="doc-list-label">Pages</div>
          {docs.length === 0 && (
            <p className="rail-foot">No pages yet. Start one, then share the link.</p>
          )}
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={`doc-item ${doc.id === activeDoc ? "active" : ""}`}
            >
              <button
                type="button"
                className="doc-item-name"
                onClick={() => openDoc(doc.id)}
              >
                {doc.title || "Untitled"}
              </button>
              <button
                type="button"
                className="delete-doc"
                aria-label={`Delete ${doc.title || "Untitled"}`}
                onClick={(event) => deleteDoc(event, doc.id)}
              >
                ×
              </button>
            </div>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        {railOpen && (
          <button
            type="button"
            className="rail-backdrop"
            aria-label="Close pages"
            onClick={() => setRailOpen(false)}
          />
        )}
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-label={railOpen ? "Close pages" : "Open pages"}
            aria-expanded={railOpen}
            onClick={() => setRailOpen((open) => !open)}
          >
            ☰
          </button>

          <input
            className="title-input"
            value={activeDoc ? docTitle : ""}
            placeholder={activeDoc ? "Untitled" : "Inkroom"}
            disabled={!activeDoc}
            aria-label="Page title"
            onChange={handleTitleChange}
            onBlur={handleBlur}
          />

          <div className="topbar-actions">
            {findOpen && activeDoc ? (
              <form className="find-bar" role="search" onSubmit={(event) => event.preventDefault()}>
                <input
                  ref={findInputRef}
                  type="search"
                  value={query}
                  placeholder="Find in page"
                  aria-label="Find in page"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveMatch(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (event.shiftKey) goPrev();
                      else goNext();
                    }
                  }}
                />
                <span className="find-count" aria-live="polite">
                  {query.trim() ? matchLabel : "Find"}
                </span>
                <button type="button" className="icon-btn" aria-label="Previous match" disabled={!matchCount} onClick={goPrev}>
                  ↑
                </button>
                <button type="button" className="icon-btn" aria-label="Next match" disabled={!matchCount} onClick={goNext}>
                  ↓
                </button>
                <button type="button" className="icon-btn" aria-label="Close find" onClick={closeFind}>
                  ×
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="icon-btn find-toggle"
                aria-label="Find in page (Ctrl+F)"
                disabled={!activeDoc}
                onClick={() => setFindOpen(true)}
              >
                Find
              </button>
            )}

            <button
              type="button"
              className="icon-btn find-toggle"
              disabled={!activeDoc}
              onClick={copyShareLink}
            >
              {shareNote || "Share"}
            </button>

            <div className="status">
              <span className={`dot ${connection}`} aria-hidden="true" />
              {connection === "error" ? (
                <button type="button" className="retry-btn" onClick={retryConnect}>
                  Reconnect
                </button>
              ) : (
                <span aria-live="polite">{statusLabel}</span>
              )}
            </div>

            <div className="avatars-inline" aria-label="People in this page">
              {users.map((user) => (
                <span
                  key={user.id}
                  className="avatar"
                  style={{ background: user.color }}
                  title={user.label}
                >
                  {user.symbol}
                </span>
              ))}
            </div>

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        {activeDoc && <Toolbar editor={editor} />}

        <main className="canvas">
          {!activeDoc && (
            <div className="empty-state">
              <Logo />
              <h1>Inkroom</h1>
              <p>A shared room for writing. Open a page, then share the link so someone can join live.</p>
              <button type="button" className="new-doc" onClick={createDoc}>
                New page
              </button>
            </div>
          )}

          {activeDoc && (
            <div className="paper">
              <div className="editor-wrap" onMouseMove={handleMouseMove}>
                {Object.values(cursors).map((cursor) => (
                  <div
                    key={cursor.id}
                    className="remote-cursor"
                    style={{
                      left: cursor.x,
                      top: cursor.y,
                      background: cursor.color,
                    }}
                  />
                ))}
                <EditorContent editor={editor} />
              </div>

              <div className="editor-footer">
                <span>
                  {words} {words === 1 ? "word" : "words"}
                </span>
                <span>{plainText(content).length} characters</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
