"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// Choosing a new password from an emailed link (?token=…).
export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repeat) {
      setError("The passwords don’t match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (error) {
      setError(
        error.code === "INVALID_TOKEN"
          ? "This link has expired or was already used. Ask for a new one."
          : (error.message ?? "That didn’t work — try again.")
      );
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <>
        <p className="auth-lede">Your password is changed, and every device was signed out. Sign in with the new one.</p>
        <p className="auth-links">
          <Link href="/login">Sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <form className="book-form auth-form" onSubmit={submit}>
        <label className="field field--wide">
          <span>New password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </label>
        <label className="field field--wide">
          <span>Repeat it</span>
          <input type="password" required minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
        </label>
        {error && (
          <p className="field--wide search-note search-note--error" role="alert">
            {error} {error.startsWith("This link") && <Link href="/forgot-password">Send a new link</Link>}
          </p>
        )}
        <div className="dialog-actions field--wide">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : "Set new password"}
          </button>
        </div>
      </form>
    </>
  );
}
