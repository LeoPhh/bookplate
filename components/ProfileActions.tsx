"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import RecommendDialog from "./RecommendDialog";
import Spinner from "./Spinner";

// On someone else's profile, for a signed-in reader: add them as a friend (or
// accept or decline their request, or cancel one, or unfriend) and recommend a
// friend a book. Blocking and reporting wait in a menu at the end of the row.

type Standing = "friends" | "sent" | "received" | "none";

export default function ProfileActions({
  id,
  handle,
  name,
  standing,
  reportHref,
}: {
  id: string;
  handle: string;
  name: string;
  standing: Standing;
  reportHref: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"unfriend" | "block" | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const act = async (path: string, method: string, body?: unknown, then?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t work. Try again.");
      if (then) then();
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-cta">
      {standing === "none" && (
        <button type="button" className="btn btn--accent" disabled={busy} onClick={() => act("/api/friends/requests", "POST", { handle })}>
          {busy ? <><Spinner />Sending…</> : "Add friend"}
        </button>
      )}
      {standing === "received" && (
        <>
          <button
            type="button"
            className="btn btn--accent"
            disabled={busy}
            onClick={() => act(`/api/friends/requests/${id}`, "POST", { accept: true })}
          >
            Accept
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => act(`/api/friends/requests/${id}`, "POST", { accept: false })}>
            Decline
          </button>
        </>
      )}
      {standing === "sent" && (
        <button type="button" className="btn" disabled={busy} onClick={() => act(`/api/friends/requests/${id}`, "DELETE")}>
          Cancel friend request
        </button>
      )}
      {standing === "friends" && (
        <>
          <button type="button" className="btn btn--accent" disabled={busy} onClick={() => setRecommending(true)}>
            Recommend a book
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setConfirm("unfriend")}>
            Unfriend
          </button>
        </>
      )}
      <div className="profile-menu" ref={menu}>
        <button
          type="button"
          className="btn profile-menu-button"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={busy}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="2" cy="7" r="1.5" />
            <circle cx="7" cy="7" r="1.5" />
            <circle cx="12" cy="7" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <div className="user-menu-panel profile-menu-panel" role="menu">
            {reportHref && (
              <a className="user-menu-item" role="menuitem" href={reportHref} onClick={() => setMenuOpen(false)}>
                Report this profile
              </a>
            )}
            <button
              type="button"
              className="user-menu-item profile-menu-danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setConfirm("block");
              }}
            >
              Block
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="settings-note settings-note--error" role="alert">
          {error}
        </p>
      )}
      {recommending && <RecommendDialog to={id} name={name} onClose={() => setRecommending(false)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm === "block" ? `Block ${name}?` : `Stop being friends with ${name}?`}
          message={
            confirm === "block"
              ? "You stop being friends, any request between you goes, and neither of you can see or find the other. They aren’t told."
              : "You stop seeing each other’s reading. They aren’t told."
          }
          confirmLabel={confirm === "block" ? "Block" : "Unfriend"}
          danger
          onConfirm={() => {
            const which = confirm;
            setConfirm(null);
            // Once blocked, this page is gone for the reader too.
            void (which === "block"
              ? act(`/api/blocks/${id}`, "PUT", undefined, () => router.push("/profile"))
              : act(`/api/friends/${id}`, "DELETE"));
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
