import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

export default function Editor() {
  const [title, setTitle] = useState("Untitled document");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Saved locally");

  const editorRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  const wordCount =
    content.trim() === ""
      ? 0
      : content.trim().split(/\s+/).length;

  useEffect(() => {
    socket.on("connect", () => {
      setStatus("Connected");
    });

    socket.on("document", (data) => {
      isRemoteUpdate.current = true;
      setContent(data);

      if (editorRef.current) {
        editorRef.current.textContent = data;
      }

      setStatus("Synced");
    });

    return () => {
      socket.off("connect");
      socket.off("document");
    };
  }, []);

  function handleInput(e) {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const text = e.currentTarget.textContent;
    setContent(text);
    setStatus("Live editing…");

    socket.emit("edit", text);
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <input
          className="editor-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span>{status}</span>
      </div>

      <div
        ref={editorRef}
        className="editor"
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
      />

      <div className="editor-footer">
        <span>{wordCount} words</span>
        <span>{content.length} characters</span>
      </div>
    </div>
  );
}