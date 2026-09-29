// A callout block for the notes editor — the boxed "Note / Tip / Warning"
// aside you get in most document editors.
//
// Markdown has no callout of its own, so it travels as a GitHub-style alert:
//
//     > [!NOTE]
//     > Kept me up until 2am.
//
// which still reads as a plain blockquote anywhere that doesn't know the
// syntax. Round-tripping is done in this file: `serialize` writes the marker
// line, and `parse.updateDOM` turns the blockquote markdown-it produced back
// into a callout element before TipTap parses the HTML.

import { Node, mergeAttributes } from "@tiptap/core";
import type { MarkdownNodeSpec } from "tiptap-markdown";

export const CALLOUT_KINDS = ["note", "tip", "important", "warning", "caution"] as const;

export type CalloutKind = (typeof CALLOUT_KINDS)[number];

const MARKER = new RegExp(`^\\s*\\[!(${CALLOUT_KINDS.join("|")})\\]\\s*(?:<br\\s*/?>)?\\s*`, "i");

function isKind(value: string): value is CalloutKind {
  return (CALLOUT_KINDS as readonly string[]).includes(value);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap the selection in a callout, or unwrap it if it already is one. */
      toggleCallout: (kind?: CalloutKind) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "note" as CalloutKind,
        parseHTML: (element) => {
          const kind = element.getAttribute("data-callout") ?? "";
          return isKind(kind) ? kind : "note";
        },
        renderHTML: (attributes) => ({ "data-callout": attributes.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "callout" }), 0];
  },

  addCommands() {
    return {
      toggleCallout:
        (kind = "note") =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { kind }),
    };
  },

  addStorage() {
    const markdown: MarkdownNodeSpec = {
      serialize(state, node) {
        state.wrapBlock("> ", null, node, () => {
          state.write(`[!${String(node.attrs.kind).toUpperCase()}]`);
          state.ensureNewLine();
          state.renderContent(node);
        });
      },
      parse: {
        // markdown-it renders the alert as a plain blockquote whose first
        // paragraph opens with the marker; lift those into callout elements.
        updateDOM(element) {
          element.querySelectorAll("blockquote").forEach((quote) => {
            const first = quote.firstElementChild;
            const match = first && MARKER.exec(first.innerHTML);
            if (!first || !match) return;

            first.innerHTML = first.innerHTML.slice(match[0].length);
            if (!first.textContent?.trim() && !first.children.length) first.remove();

            const callout = element.ownerDocument.createElement("div");
            callout.setAttribute("data-callout", match[1].toLowerCase());
            while (quote.firstChild) callout.appendChild(quote.firstChild);
            if (!callout.children.length) callout.appendChild(element.ownerDocument.createElement("p"));
            quote.replaceWith(callout);
          });
        },
      },
    };
    return { markdown };
  },
});
