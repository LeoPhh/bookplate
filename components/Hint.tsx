"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { HintId } from "@/lib/hints";

// A short explanation at the top of a page, until the reader chooses
// "Don't show again" (kept on the account, lib/hints.ts). Hidden until the
// server says it hasn't been turned off, so it never flashes up and away.

let dismissed: Promise<string[]> | null = null;
const loadDismissed = () =>
  (dismissed ??= fetch("/api/account/hints")
    .then((r) => (r.ok ? r.json() : { dismissed: [] }))
    .then((d: { dismissed?: string[] }) => d.dismissed ?? [])
    .catch(() => {
      dismissed = null; // try again next time
      return [];
    }));

export default function Hint({ id, title, children }: { id: HintId; title: string; children: ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let live = true;
    loadDismissed().then((list) => live && setShow(!list.includes(id)));
    return () => {
      live = false;
    };
  }, [id]);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    dismissed = (dismissed ?? Promise.resolve([])).then((list) => [...list, id]);
    void fetch("/api/account/hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hint: id }),
    }).catch(() => {});
  };

  return (
    <aside className="hint" aria-label={title}>
      <div className="hint-body">
        <h2 className="hint-title">{title}</h2>
        <div className="hint-text">{children}</div>
      </div>
      <button type="button" className="btn hint-dismiss" onClick={dismiss}>
        Don’t show again
      </button>
    </aside>
  );
}
