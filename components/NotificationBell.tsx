"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Someone } from "@/lib/social/friends";
import type { Notification, NotificationKind } from "@/lib/social/notifications";
import Avatar from "./Avatar";
import Spinner from "./Spinner";

// The bell beside the profile picture (SOCIAL=true): how much is new, and a
// panel to answer friend requests and read the rest. Opening it counts as having
// seen the news. It starts from what the server knew, then asks again on every
// page, whenever the tab comes back, and each minute while it's showing.

interface News {
  unread: number;
  incoming: Someone[];
  notifications: Notification[];
}

const POLL_MS = 60_000;

// A request waiting for an answer is listed apart, with its buttons.
const NEWS: Record<Exclude<NotificationKind, "friend_request">, string> = {
  friend_accepted: "is now your friend",
  recommendation: "recommended you a book",
};

const nameOf = (p: { name: string; handle: string | null }) => p.name || (p.handle ? `@${p.handle}` : "A reader");

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

// Null when it can't be had (offline, signed out meanwhile): the next try will do.
async function fetchNews(): Promise<News | null> {
  try {
    const res = await fetch("/api/notifications");
    return res.ok ? ((await res.json()) as News) : null;
  } catch {
    return null;
  }
}

export default function NotificationBell({ initial }: { initial: number }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initial);
  const [news, setNews] = useState<News | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const show = useCallback((fresh: News | null) => {
    if (fresh) {
      setNews(fresh);
      setUnread(fresh.unread);
    }
    return fresh;
  }, []);

  useEffect(() => {
    void fetchNews().then(show);
  }, [show, path, initial]);

  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") void fetchNews().then(show);
    };
    const timer = setInterval(again, POLL_MS);
    document.addEventListener("visibilitychange", again);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
    };
  }, [show]);

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

  const toggle = async () => {
    const opening = !open;
    setOpen(opening);
    setMessage(null);
    if (!opening) return;
    const fresh = show(await fetchNews());
    if (fresh && fresh.unread > 0) {
      setUnread(0);
      await fetch("/api/notifications/read", { method: "POST" }).catch(() => undefined);
    }
  };

  const answer = async (p: Someone, accept: boolean) => {
    setBusy(p.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/friends/requests/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t work. Try again.");
      if (accept) setMessage({ ok: true, text: `You and ${nameOf(p)} are friends now.` });
      show(await fetchNews());
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "That didn’t work. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const others = (news?.notifications ?? []).filter((n) => n.kind !== "friend_request");
  const incoming = news?.incoming ?? [];

  return (
    <div className="notify" ref={ref}>
      <button
        type="button"
        className="notify-button"
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
      >
        <svg className="notify-icon" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3 V6" />
          <path d="M16 6 C10.5 6 8 10 8 14.5 V20 C8 22 6.5 23.5 5 25 H27 C25.5 23.5 24 22 24 20 V14.5 C24 10 21.5 6 16 6 Z" />
          <path d="M13 25 V26 A3 3 0 0 0 19 26 V25" />
        </svg>
        {unread > 0 && <span className="appbar-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notify-panel">
          {message && (
            <p className={message.ok ? "notify-note" : "notify-note notify-note--error"} role="status">
              {message.text}
            </p>
          )}
          {!news && (
            <p className="notify-empty" role="status">
              <Spinner />
              Loading…
            </p>
          )}
          {news && incoming.length === 0 && others.length === 0 && <p className="notify-empty">Nothing new.</p>}
          {incoming.length > 0 && (
            <section className="notify-section">
              <h2 className="notify-heading">Friend requests</h2>
              <ul className="notify-list">
                {incoming.map((p) => (
                  <li key={p.id} className="notify-request">
                    <Avatar image={p.image} label={p.name || p.handle} color={p.color} size={36} />
                    <span className="search-result-text">
                      {p.handle ? (
                        <Link className="search-result-title" href={`/u/${p.handle}`} onClick={() => setOpen(false)}>
                          {nameOf(p)}
                        </Link>
                      ) : (
                        <span className="search-result-title">{nameOf(p)}</span>
                      )}
                      {p.handle && p.name && <span className="search-result-meta">{`@${p.handle}`}</span>}
                    </span>
                    <span className="notify-actions">
                      <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={() => answer(p, true)}>
                        {busy === p.id ? <Spinner /> : null}
                        Accept
                      </button>
                      <button type="button" className="btn" disabled={busy !== null} onClick={() => answer(p, false)}>
                        Decline
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {others.length > 0 && (
            <section className="notify-section">
              <h2 className="notify-heading">Lately</h2>
              <ul className="notify-list">
                {others.map((n) => {
                  const text = (
                    <>
                      <strong>{n.actor ? nameOf(n.actor) : "Someone"}</strong> {NEWS[n.kind as keyof typeof NEWS]}
                    </>
                  );
                  const href = n.kind === "recommendation" ? "/friends?tab=recommendations" : n.actor?.handle ? `/u/${n.actor.handle}` : null;
                  return (
                    <li key={n.id} className={n.read ? "notify-item" : "notify-item notify-item--new"}>
                      {href ? (
                        <Link className="notify-item-text" href={href} onClick={() => setOpen(false)}>
                          {text}
                        </Link>
                      ) : (
                        <span className="notify-item-text">{text}</span>
                      )}
                      <span className="friends-news-date">{dateOf(n.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <Link className="notify-all" href="/friends" onClick={() => setOpen(false)}>
            All friends and requests →
          </Link>
        </div>
      )}
    </div>
  );
}
