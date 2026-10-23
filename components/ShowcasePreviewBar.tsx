"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ShowcaseInclude } from "@/lib/showcaseYear";
import { setupHref } from "./ShowcaseSetup";
import Spinner from "./Spinner";

// Along the top of a showcase preview: a reminder that only the reader sees
// it, the way back to the setup page, and a button to put this one on show.
export default function ShowcasePreviewBar({
  year,
  include,
  name,
  liveYear,
}: {
  year: number;
  include: ShowcaseInclude;
  name: string;
  liveYear: number | null; // the year on show now, if any
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, include, name }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t save. Try again.");
      router.push("/showcase");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t save. Try again.");
      setBusy(false);
    }
  };

  const label = liveYear === null ? `Showcase ${year}` : liveYear === year ? "Save these settings" : `Switch to ${year}`;

  return (
    <div className="preview-bar">
      <p className="preview-bar-text">
        <strong>Preview.</strong> Only you can see this page.
      </p>
      <div className="preview-bar-actions">
        <Link className="btn" href={setupHref(year, include, name)}>
          ← Back
        </Link>
        <button type="button" className="btn btn--accent" disabled={busy} onClick={save}>
          {busy ? <><Spinner />Saving…</> : label}
        </button>
      </div>
      {error && (
        <p className="settings-note settings-note--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
