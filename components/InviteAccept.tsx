"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "./Spinner";

// The invite page's button: takes the invite up, then opens Friends.
export default function InviteAccept({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/friends/invites/${token}`, { method: "POST" });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t work. Try again.");
      router.push("/friends");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work. Try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn--accent showcase-cta-button" disabled={busy} onClick={accept}>
        {busy ? <><Spinner />Saying yes…</> : label}
      </button>
      {error && (
        <p className="settings-note settings-note--error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
