"use client";

import { useState } from "react";

// Settings → Profile → Blocked: the readers this reader blocked, to unblock.
export default function BlockedList({ initial }: { initial: { id: string; name: string; handle: string | null }[] }) {
  const [blocked, setBlocked] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const unblock = async (id: string) => {
    setBusy(id);
    setError(false);
    try {
      const res = await fetch(`/api/blocks/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      setBlocked((b) => b.filter((p) => p.id !== id));
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ul className="friend-list">
        {blocked.map((p) => (
          <li key={p.id} className="friend">
            <span className="friend-who">
              <span className="friend-name">{p.name || (p.handle ? `@${p.handle}` : "A reader")}</span>
            </span>
            <span className="friend-actions">
              <button type="button" className="btn" disabled={busy !== null} onClick={() => unblock(p.id)}>
                Unblock
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <p className="settings-note settings-note--error" role="alert">
          That didn&rsquo;t work. Try again.
        </p>
      )}
    </>
  );
}
