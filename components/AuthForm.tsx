"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import AuthShell, { LegalLink } from "./AuthShell";
import type { LegalLinks } from "@/lib/legal";

type Mode = "setup" | "login" | "signup";

const TITLES: Record<Mode, string> = {
  setup: "Set up your library",
  login: "Sign in",
  signup: "Create an account",
};

interface Props {
  mode: Mode;
  // New accounts must confirm their email first (open registration + email).
  requireVerification?: boolean;
  // Anyone may sign up on this server (REGISTRATION=open).
  signupOpen?: boolean;
  // Shown on arrival, e.g. after an expired confirmation link.
  notice?: string;
  // Sign-ups carry a solved proof-of-work puzzle (lib/botCheck.ts).
  botCheck?: boolean;
  // The server's privacy policy and terms, if it has them (LEGAL_DIR).
  legal?: LegalLinks;
}

// Fetches a sign-up puzzle and solves it in the background; resolves to the
// header value the server expects, or null if that didn't work.
async function solvePuzzle(): Promise<string | null> {
  try {
    const res = await fetch("/api/signup-challenge", { cache: "no-store" });
    if (!res.ok) return null;
    const challenge = await res.json();
    const [{ solveChallenge }, { deriveKey }] = await Promise.all([
      import("altcha-lib"),
      import("altcha-lib/algorithms/web/pbkdf2"),
    ]);
    const solution = await solveChallenge({ challenge, deriveKey });
    if (!solution) return null;
    return btoa(JSON.stringify({ challenge, solution }));
  } catch {
    return null;
  }
}

// First-run setup (the owner account), sign-up on open servers, and sign-in
// share one card.
export default function AuthForm({
  mode,
  requireVerification = false,
  signupOpen = false,
  notice,
  botCheck = false,
  legal,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);
  const creating = mode !== "login";

  // Started as soon as the form opens, so it's usually done before anyone
  // finishes typing. Each puzzle works once: a failed attempt starts another.
  const puzzle = useRef<Promise<string | null> | null>(null);
  const startPuzzle = useCallback(() => {
    puzzle.current = creating && botCheck ? solvePuzzle() : null;
  }, [creating, botCheck]);
  useEffect(startPuzzle, [startPuzzle]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // After confirming their email, new readers land on the sign-in page,
    // which forwards them into the library (or explains a bad link).
    const solved = puzzle.current ? await puzzle.current : null;
    const { error } = creating
      ? await authClient.signUp.email(
          { name: name.trim() || "Reader", email, password, callbackURL: "/login" },
          solved ? { headers: { "x-signup-challenge": solved } } : undefined
        )
      : await authClient.signIn.email({ email, password });
    if (error) startPuzzle();
    setBusy(false);
    if (error) {
      setError(
        error.code === "EMAIL_NOT_VERIFIED"
          ? "Confirm your email address first — we’ve sent a new link to your inbox."
          : (error.message ?? "That didn’t work — try again.")
      );
      return;
    }
    if (creating && requireVerification) {
      setCheckInbox(true);
      return;
    }
    window.location.href = "/";
  };

  if (checkInbox) {
    return (
      <AuthShell title="Check your inbox">
        <p className="auth-lede">
          We’ve sent a link to <strong>{email}</strong>. Open it to confirm your address and finish setting up your
          account. It expires in an hour.
        </p>
        <p className="auth-links">
          <Link href="/login">Back to sign in</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={TITLES[mode]} legal={legal}>
      {mode === "setup" && (
        <p className="auth-lede">
          Create the account that owns this Bookplate. It’s the only one — nobody else can sign up afterwards.
        </p>
      )}
      {notice && (
        <p className="auth-lede search-note--error" role="alert">
          {notice}
        </p>
      )}
      <form className="book-form auth-form" onSubmit={submit}>
        {creating && (
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
            autoComplete={creating ? "new-password" : "current-password"}
          />
        </label>
        {error && (
          <p className="field--wide search-note search-note--error" role="alert">
            {error}
          </p>
        )}
        {creating && legal && (legal.privacy || legal.terms) && (
          <p className="field--wide auth-consent">
            By creating an account you agree to the{" "}
            {legal.terms && <LegalLink href={legal.terms}>Terms of use</LegalLink>}
            {legal.terms && legal.privacy && " and "}
            {legal.privacy && <LegalLink href={legal.privacy}>Privacy policy</LegalLink>}.
          </p>
        )}
        <div className="dialog-actions field--wide">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "One moment…" : creating ? "Create account" : "Sign in"}
          </button>
        </div>
      </form>
      {mode === "login" && (
        <p className="auth-links">
          <Link href="/forgot-password">Forgot password?</Link>
          {signupOpen && <Link href="/signup">Create an account</Link>}
        </p>
      )}
      {mode === "signup" && (
        <p className="auth-links">
          <Link href="/login">Already have an account? Sign in</Link>
        </p>
      )}
    </AuthShell>
  );
}
