"use client";

import { useEffect, useState } from "react";
import type { Someone } from "@/lib/social/friends";
import Avatar from "./Avatar";

// The Friends tile on a profile. On someone else's it opens their friends in
// a dialog to scroll through; the link underneath (their friends page) is
// for opening it in a new tab, or without JavaScript. On the reader's own
// profile it simply leads to their friends page, where requests and
// recommendations are.
export default function FriendsTile({
  href,
  list,
  children,
}: {
  href: string;
  list: { title: string; friends: Someone[] } | null; // null: the reader's own tile
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <a
        className="stat-tile profile-friends"
        href={href}
        aria-haspopup={list ? "dialog" : undefined}
        onClick={(e) => {
          // A plain click opens the dialog; one asking for a new tab doesn't.
          if (!list || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open && list && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div
            className="dialog friends-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={list.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="dialog-close" onClick={() => setOpen(false)} aria-label="Close" autoFocus>
              ✕
            </button>
            <h2 className="confirm-title">{list.title}</h2>
            {list.friends.length === 0 ? (
              <p className="settings-lede">No friends yet.</p>
            ) : (
              <ul className="friend-list friends-dialog-list">
                {list.friends.map((f) => (
                  <li key={f.id} className="friend">
                    <Avatar image={f.image} size={44} />
                    <span className="friend-who">
                      {f.handle ? (
                        <a className="friend-name" href={`/u/${f.handle}`}>
                          {f.name || `@${f.handle}`}
                        </a>
                      ) : (
                        <span className="friend-name">{f.name || "A reader"}</span>
                      )}
                      {f.handle && f.name && <span className="friend-handle">{`@${f.handle}`}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
