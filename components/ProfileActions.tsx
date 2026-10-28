"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import RecommendDialog from "./RecommendDialog";
import Spinner from "./Spinner";

// Under someone else's profile, for a signed-in reader: ask to be friends
// (or answer their request, or take one back, or unfriend), recommend a
// friend a book, and block.

type Standing = "friends" | "sent" | "received" | "none";

export default function ProfileActions({ id, handle, name, standing }: { id: string; handle: string; name: string; standing: Standing }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"unfriend" | "block" | null>(null);
  const [recommending, setRecommending] = useState(false);

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
    <div className="profile-actions">
      {standing === "none" && (
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => act("/api/friends/requests", "POST", { handle })}>
          {busy ? <><Spinner />Asking…</> : "Ask to be friends"}
        </button>
      )}
      {standing === "received" && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => act(`/api/friends/requests/${id}`, "POST", { accept: true })}
        >
          {busy ? <><Spinner />Accepting…</> : `Accept ${name}’s request`}
        </button>
      )}
      {standing === "sent" && (
        <>
          <span className="badge">Request sent</span>
          <button type="button" className="btn" disabled={busy} onClick={() => act(`/api/friends/requests/${id}`, "DELETE")}>
            Take back
          </button>
        </>
      )}
      {standing === "friends" && (
        <>
          <span className="badge">Friends</span>
          <button type="button" className="btn btn--accent" disabled={busy} onClick={() => setRecommending(true)}>
            Recommend a book
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setConfirm("unfriend")}>
            Unfriend
          </button>
        </>
      )}
      <button type="button" className="btn btn--danger" disabled={busy} onClick={() => setConfirm("block")}>
        Block
      </button>
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
