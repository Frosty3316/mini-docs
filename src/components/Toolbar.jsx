export function Toolbar({ editor }) {
  if (!editor) return null;

  const size = editor.getAttributes("textStyle").fontSize || "";

  return (
    <div className="toolbar" role="toolbar" aria-label="Text formatting">
      <button
        type="button"
        className={editor.isActive("heading", { level: 1 }) ? "active" : ""}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        Title
      </button>
      <button
        type="button"
        className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        Heading
      </button>
      <button
        type="button"
        className={editor.isActive("heading", { level: 3 }) ? "active" : ""}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        Subhead
      </button>
      <button
        type="button"
        className={editor.isActive("paragraph") && !editor.isActive("heading") ? "active" : ""}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        Body
      </button>

      <span className="toolbar-rule" aria-hidden="true" />

      <button
        type="button"
        className={size === "0.95rem" ? "active" : ""}
        onClick={() => editor.chain().focus().setFontSize("0.95rem").run()}
      >
        S
      </button>
      <button
        type="button"
        className={!size ? "active" : ""}
        onClick={() => editor.chain().focus().unsetFontSize().run()}
      >
        M
      </button>
      <button
        type="button"
        className={size === "1.45rem" ? "active" : ""}
        onClick={() => editor.chain().focus().setFontSize("1.45rem").run()}
      >
        L
      </button>

      <span className="toolbar-rule" aria-hidden="true" />

      <button
        type="button"
        className={editor.isActive("bold") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={editor.isActive("italic") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={editor.isActive("underline") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline-mark">U</span>
      </button>

      <span className="toolbar-rule" aria-hidden="true" />

      <button
        type="button"
        className={editor.isActive("bulletList") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        List
      </button>
      <button
        type="button"
        className={editor.isActive("orderedList") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </button>
    </div>
  );
}
