"use client";

import { useEffect, useState } from "react";
import type { Someone } from "@/lib/social/friends";
import Avatar from "./Avatar";
import ProfileIcon from "./ProfileIcon";

// The Friends card on a profile: how many, and the first few as separate tiles,
// the last one counting the rest. On someone else's profile the full list opens
// in a dialog to scroll through (the link is for opening it in a new tab, or
// without JavaScript). On the reader's own it leads to their friends page, where
// requests and recommendations are.

const FACES = 6;

export default function FriendsCard({
  span,
  href,
  friends,
  title,
  own,
  news,
}: {
  span: string;
  href: string;
  friends: Someone[];
  title: string;
  own: boolean;
  news: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A plain click opens the dialog; one asking for a new tab doesn't.
  const show = (e: React.MouseEvent) => {
    if (own || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setOpen(true);
  };

  const faces = friends.length > FACES ? friends.slice(0, FACES - 1) : friends;
  const rest = friends.length - faces.length;

  return (
    <section className={`profile-card ${span}`}>
      <div className="profile-card-head">
        <ProfileIcon name="friends" />
        <h2>Friends</h2>
        {news > 0 && <span className="profile-news">{`${news} new`}</span>}
      </div>
      <p className="profile-big profile-friend-count">{friends.length.toLocaleString("en-GB")}</p>
      {friends.length > 0 && (
        <ul className="profile-faces">
          {faces.map((f) => (
            <li key={f.id}>
              <a href={f.handle ? `/u/${f.handle}` : href} title={f.name || (f.handle ? `@${f.handle}` : undefined)} aria-label={f.name || (f.handle ? `@${f.handle}` : "A reader")}>
                <Avatar image={f.image} label={f.name || f.handle} color={f.color} size={48} />
              </a>
            </li>
          ))}
          {rest > 0 && (
            <li>
              <a className="profile-faces-rest" href={href} onClick={show} aria-label={`See all ${friends.length} friends`}>
                {`+${rest}`}
              </a>
            </li>
          )}
        </ul>
      )}
      {friends.length > 0 || own ? (
        <a className="profile-card-link" href={href} onClick={show} aria-haspopup={own ? undefined : "dialog"}>
          {friends.length > 0 ? "See all friends →" : "Find friends →"}
        </a>
      ) : (
        <p className="profile-note">None to show yet.</p>
      )}
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="dialog friends-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="dialog-close" onClick={() => setOpen(false)} aria-label="Close" autoFocus>
              ✕
            </button>
            <h2 className="confirm-title">{title}</h2>
            {friends.length === 0 ? (
              <p className="settings-lede">No friends yet.</p>
            ) : (
              <ul className="friend-list friends-dialog-list">
                {friends.map((f) => (
                  <li key={f.id} className="friend">
                    <Avatar image={f.image} label={f.name || f.handle} color={f.color} size={44} />
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
    </section>
  );
}
