import { useState } from "react";

export default function Editor() {
  const [title, setTitle] = useState("Untitled document");
  const [content, setContent] = useState("");

  const wordCount =
    content.trim() === ""
      ? 0
      : content.trim().split(/\s+/).length;

  return (
    <div className="editor-container">
      <div className="editor-header">
        <input
          className="editor-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span>Saved locally</span>
      </div>

      <div
        className="editor"
        contentEditable
        onInput={(e) => setContent(e.currentTarget.textContent)}
        suppressContentEditableWarning
      />

      <div className="editor-footer">
        <span>{wordCount} words</span>
        <span>{content.length} characters</span>
      </div>
    </div>
  );
}