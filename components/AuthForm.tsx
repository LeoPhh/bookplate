"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

// The first-run setup (creates the owner account) and the sign-in form share
// one card.
export default function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === "setup"
        ? await authClient.signUp.email({ name: name.trim() || "Reader", email, password })
        : await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "That didn't work — try again.");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  };

  return (
    <main className="page auth-page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Bookplate</h1>
      </header>
      <div className="dialog auth-card">
        <h2 className="form-heading">{mode === "setup" ? "Set up your library" : "Sign in"}</h2>
        {mode === "setup" && (
          <p className="auth-lede">
            Create the account that owns this Bookplate. It&rsquo;s the only one — nobody else can sign up afterwards.
          </p>
        )}
        <form className="book-form auth-form" onSubmit={submit}>
          {mode === "setup" && (
            <label className="field field--wide">
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field field--wide">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>
          <label className="field field--wide">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "setup" ? "new-password" : "current-password"}
            />
          </label>
          {error && (
            <p className="field--wide search-note search-note--error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions field--wide">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "One moment…" : mode === "setup" ? "Create account" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
