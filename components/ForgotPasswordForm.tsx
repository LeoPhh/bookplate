"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// "Send me a reset link" — only shown when the server can send email.
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    if (error) {
      setError(error.message ?? "That didn’t work — try again in a minute.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <>
        {/* Same message whether or not the address has an account. */}
        <p className="auth-lede">
          If <strong>{email}</strong> has an account here, a link to choose a new password is on its way. It works once
          and expires in an hour.
        </p>
        <p className="auth-links">
          <Link href="/login">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="auth-lede">Enter the email you sign in with, and we’ll send you a link to choose a new password.</p>
      <form className="book-form auth-form" onSubmit={submit}>
        <label className="field field--wide">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </label>
        {error && (
          <p className="field--wide search-note search-note--error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions field--wide">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </div>
      </form>
      <p className="auth-links">
        <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}
