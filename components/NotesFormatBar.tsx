"use client";

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";

// Anything without a scheme is treated as a bare domain the reader typed.
function normalizeHref(value: string): string {
  const url = value.trim();
  if (!url) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/") || url.startsWith("#")) return url;
  return "https://" + url;
}

export default function NotesFormatBar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // useEditor doesn't re-render on every transaction, so the pressed states
  // come from a subscription to the bits of editor state the bar shows.
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      link: editor.isActive("link"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      callout: editor.isActive("callout"),
      codeBlock: editor.isActive("codeBlock"),
    }),
  });

  const button = (
    key: string,
    label: string,
    title: string,
    on: boolean,
    run: () => void,
    modifier?: string
  ) => (
    <button
      key={key}
      type="button"
      className={"fmt-btn" + (modifier ? " fmt-btn--" + modifier : "") + (on ? " fmt-btn--active" : "")}
      title={title}
      aria-label={title}
      aria-pressed={on}
      // Keep the caret where it is — the button must not steal the selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );

  const openLink = () => {
    setLinkUrl((editor.getAttributes("link").href as string) ?? "");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href = normalizeHref(linkUrl);
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected — drop the address in as its own linked text.
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div className="notes-fmt">
      <div className="fmt-bar" role="toolbar" aria-label="Formatting">
        <div className="fmt-group">
          {button("h1", "H1", "Heading 1", active.h1, () =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          )}
          {button("h2", "H2", "Heading 2", active.h2, () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          )}
          {button("h3", "H3", "Heading 3", active.h3, () =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          )}
        </div>

        <div className="fmt-group">
          {button("bold", "B", "Bold", active.bold, () => editor.chain().focus().toggleBold().run(), "bold")}
          {button("italic", "I", "Italic", active.italic, () => editor.chain().focus().toggleItalic().run(), "italic")}
          {button("strike", "S", "Strikethrough", active.strike, () => editor.chain().focus().toggleStrike().run(), "strike")}
          {button("code", "Code", "Inline code", active.code, () => editor.chain().focus().toggleCode().run(), "code")}
          {button("link", "Link", "Link", active.link || linkOpen, openLink)}
        </div>

        <div className="fmt-group">
          {button("bullets", "Bullets", "Bulleted list", active.bulletList, () =>
            editor.chain().focus().toggleBulletList().run()
          )}
          {button("numbers", "Numbers", "Numbered list", active.orderedList, () =>
            editor.chain().focus().toggleOrderedList().run()
          )}
        </div>

        <div className="fmt-group">
          {button("quote", "Quote", "Blockquote", active.blockquote, () =>
            editor.chain().focus().toggleBlockquote().run()
          )}
          {button("callout", "Callout", "Callout box", active.callout, () =>
            editor.chain().focus().toggleCallout().run()
          )}
          {button("codeblock", "Code block", "Code block", active.codeBlock, () =>
            editor.chain().focus().toggleCodeBlock().run()
          )}
        </div>
      </div>

      {linkOpen && (
        <div className="fmt-link">
          <input
            className="fmt-link-input"
            type="url"
            autoFocus
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
              }
            }}
          />
          <button type="button" className="fmt-btn fmt-btn--wide" onClick={applyLink}>
            Apply
          </button>
          {active.link && (
            <button type="button" className="fmt-btn fmt-btn--wide" onClick={removeLink}>
              Remove
            </button>
          )}
          <button type="button" className="fmt-btn fmt-btn--wide" onClick={() => setLinkOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
