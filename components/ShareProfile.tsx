"use client";

import { useEffect, useRef, useState } from "react";
import type { Visibility } from "@/lib/social/profile";

// Next to the reader's name on their own profile: a menu to send its link
// through WhatsApp, Facebook, X or Messenger, or to copy it. Messenger's
// share link only opens the app, so it's offered on phones and tablets.

// Who'll see the reading on it: the profile itself opens for anyone.
const NOTE: Record<Visibility, string> = {
  private: "Anyone can open it. Your reading stays private.",
  friends: "Anyone can open it. Only your friends see your reading.",
  public: "Anyone can open it and see your reading.",
};

const enc = encodeURIComponent;

export default function ShareProfile({ url, name, visibility }: { url: string; name: string; visibility: Visibility }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [touch, setTouch] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const text = `${name ? `${name}’s` : "My"} reading on Bookplate`;
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${text}: ${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X", href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}` },
    ...(touch ? [{ label: "Messenger", href: `fb-messenger://share/?link=${enc(url)}` }] : []),
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="share" ref={ref}>
      <button
        type="button"
        className="btn share-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setCopied(false);
          setTouch(window.matchMedia("(pointer: coarse)").matches);
        }}
      >
        <svg className="share-icon" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 4 V20" />
          <path d="M10 10 L16 4 L22 10" />
          <path d="M9 14 H5 V28 H27 V14 H23" />
        </svg>
        Share
      </button>
      {open && (
        <div className="share-panel" role="menu">
          <p className="share-note">{NOTE[visibility]}</p>
          {links.map((l) => (
            <a
              key={l.label}
              className="user-menu-item"
              role="menuitem"
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <button type="button" className="user-menu-item share-copy" role="menuitem" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </button>
          {error && (
            <input
              className="share-url"
              type="text"
              readOnly
              value={url}
              autoFocus
              onFocus={(e) => e.target.select()}
              aria-label="Profile link"
            />
          )}
        </div>
      )}
    </div>
  );
}
