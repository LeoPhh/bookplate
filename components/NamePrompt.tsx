"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { NAME_MAX } from "@/lib/names";
import type { HintId } from "@/lib/hints";
import Spinner from "./Spinner";

const HINT: HintId = "name-prompt";

// Asks a reader with no name for one, once. Saving a name can replace a default
// username (lib/auth.ts), which would leave this page at an address that's gone.
export default function NamePrompt({ suggestion, username }: { suggestion: string; username: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = () => {
    setOpen(false);
    void fetch("/api/account/hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hint: HINT }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answered();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.updateUser({ name });
    if (error) {
      setBusy(false);
      setError(error.message ?? "Your name could not be saved.");
      return;
    }
    answered();
    authClient.$store.notify("$sessionSignal");
    const own = username ? `/u/${username}` : null;
    if (own && (path === own || path.startsWith(`${own}/`))) {
      const res = await fetch("/api/profile").catch(() => null);
      const data: { profile?: { handle: string } } = res?.ok ? await res.json() : {};
      window.location.replace(data.profile ? `/u/${data.profile.handle}${path.slice(own.length)}` : "/");
      return;
    }
    router.refresh();
  };

  return (
    <div className="overlay overlay--top">
      <div className="dialog dialog--confirm name-prompt" role="dialog" aria-modal="true" aria-labelledby="name-prompt-title">
        <h2 className="confirm-title" id="name-prompt-title">
          What should we call you?
        </h2>
        <p className="confirm-message">Your name appears on your profile, so friends can recognise you.</p>
        <form className="profile-form" onSubmit={save}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="name"
              placeholder="Your name"
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {suggestion && name === suggestion && (
            <p className="field-note">We suggested this from your email address. Change it if it isn’t right.</p>
          )}
          {error && (
            <p className="field-note field-note--error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !name.trim()}>
              {busy ? <Spinner /> : "Save"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={answered}>
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
