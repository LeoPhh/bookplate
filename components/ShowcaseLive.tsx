"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";

// The Showcase tab while the reader's showcase is on: its link, and ways to
// change it or turn it off. Turning it off brings the tab's pitch back.
export default function ShowcaseLive({ id, year, url, summary }: { id: string; year: number; url: string; summary: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Copying didn’t work. Select the link and copy it.");
    }
  };

  const turnOff = async () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/showcases/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      router.refresh();
    } catch {
      setError("That didn’t work. Try again.");
      setBusy(false);
    }
  };

  return (
    <section className="live">
      <p className="live-badge">
        <span className="live-dot" />
        On display
      </p>
      <h2 className="live-title">{`Your ${year} is on display`}</h2>
      <p className="live-text">
        Anyone with the link sees {summary}. It keeps up as you read, and never shows your notes, words or email.
      </p>

      <div className="live-link">
        <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Showcase link" />
        <button type="button" className="btn btn--primary" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
          Open
        </a>
      </div>

      {error && (
        <p className="settings-note settings-note--error" role="alert">
          {error}
        </p>
      )}

      <div className="live-actions">
        <button type="button" className="btn btn--danger" disabled={busy} onClick={() => setConfirming(true)}>
          {busy ? <><Spinner />Turning off…</> : "Turn it off"}
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Turn off your showcase?"
          message="The link stops working straight away, for everyone you’ve sent it to. You can make a new one later, with a new link."
          confirmLabel="Turn it off"
          danger
          onConfirm={turnOff}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
