"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import AuthShell from "./AuthShell";
import type { LegalLinks } from "@/lib/legal";
import { isPlausibleEmail, meetsPasswordRules, MESSAGES, MIN_PASSWORD_LENGTH } from "@/lib/signupChecks";
import Spinner from "./Spinner";

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
  // Offer the newsletter tick box at sign-up (NEWSLETTER=true).
  newsletter?: boolean;
  // Where to go once signed in (a path checked by lib/nextPath.ts), e.g. back
  // to an invite link; unset = the library.
  next?: string | null;
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
  newsletter = false,
  next = null,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [subscribe, setSubscribe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const [checkInbox, setCheckInbox] = useState(false);
  // Checked only on submit; editing a field clears its message until the
  // next try.
  const [emailBad, setEmailBad] = useState(false);
  const [passwordBad, setPasswordBad] = useState(false);
  const [mismatch, setMismatch] = useState(false);
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
    if (creating) {
      // One problem at a time, by its own field, from the top down.
      const emailOk = isPlausibleEmail(email);
      const passwordOk = emailOk && meetsPasswordRules(password);
      setEmailBad(!emailOk);
      setPasswordBad(emailOk && !passwordOk);
      setMismatch(passwordOk && password !== confirm);
      if (!passwordOk || password !== confirm) return;
    }
    setBusy(true);
    setError(null);
    // After confirming their email, new readers land on the sign-in page,
    // which forwards them into the library (or explains a bad link).
    const solved = puzzle.current ? await puzzle.current : null;
    const { error } = creating
      ? await authClient.signUp.email(
          {
            name: "", // added later in Settings, if at all
            email,
            password,
            callbackURL: next ? `/login?next=${encodeURIComponent(next)}` : "/login",
            ...(mode === "signup" && newsletter ? { newsletter: subscribe } : {}),
          },
          solved ? { headers: { "x-signup-challenge": solved } } : undefined
        )
      : await authClient.signIn.email({ email, password });
    if (error) startPuzzle();
    setBusy(false);
    if (error) {
      // With email confirmation on, Better Auth answers a taken address as
      // if it were new (so nobody can test which addresses have accounts);
      // the code only arrives on servers without it.
      setError(
        error.code === "EMAIL_NOT_VERIFIED" ? (
          "Confirm your email address first. We’ve sent a new link to your inbox."
        ) : error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ? (
          <>
            {MESSAGES.emailTaken} <Link href="/login">Sign in</Link> instead?
          </>
        ) : error.code === "INVALID_EMAIL" ? (
          MESSAGES.email
        ) : (
          (error.message ?? "That didn’t work. Try again.")
        )
      );
      return;
    }
    if (creating && requireVerification) {
      setCheckInbox(true);
      return;
    }
    window.location.href = next ?? "/";
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
          Create the account that owns this Bookplate. It’s the only one. Nobody else can sign up afterwards.
        </p>
      )}
      {notice && (
        <p className="auth-lede search-note--error" role="alert">
          {notice}
        </p>
      )}
      {/* Creating an account, our own messages replace the browser's. */}
      <form className="book-form auth-form" onSubmit={submit} noValidate={creating}>
        <label className="field field--wide">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailBad(false);
            }}
            autoComplete="username"
            autoFocus
            aria-invalid={emailBad || undefined}
            aria-describedby={emailBad ? "email-note" : undefined}
          />
          {emailBad && (
            <small id="email-note" className="field-note field-note--error" role="alert">
              {MESSAGES.email}
            </small>
          )}
        </label>
        <label className="field field--wide">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordBad(false);
              setMismatch(false);
            }}
            autoComplete={creating ? "new-password" : "current-password"}
            aria-invalid={passwordBad || undefined}
            aria-describedby={passwordBad ? "password-note" : undefined}
          />
          {passwordBad && (
            <small id="password-note" className="field-note field-note--error" role="alert">
              {MESSAGES.password}
            </small>
          )}
        </label>
        {creating && (
          <label className="field field--wide">
            <span>Confirm password</span>
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setMismatch(false);
              }}
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? "confirm-note" : undefined}
            />
            {mismatch && (
              <small id="confirm-note" className="field-note field-note--error" role="alert">
                {MESSAGES.mismatch}
              </small>
            )}
          </label>
        )}
        {error && (
          <p className="field--wide search-note search-note--error" role="alert">
            {error}
          </p>
        )}
        {mode === "signup" && newsletter && (
          <label className="checkline checkline--wrap field--wide">
            <input type="checkbox" checked={subscribe} onChange={(e) => setSubscribe(e.target.checked)} />
            <span>Email me the occasional Bookplate newsletter. You can stop it any time in Settings.</span>
          </label>
        )}
        {creating && legal && (legal.privacy || legal.terms) && (
          <p className="field--wide auth-consent">
            {/* The links themselves are in the footer, just below. */}
            By creating an account you agree to the {legal.terms && "Terms of use"}
            {legal.terms && legal.privacy && " and "}
            {legal.privacy && "Privacy policy"}.
          </p>
        )}
        <div className="dialog-actions field--wide">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <><Spinner />One moment…</> : creating ? "Create account" : "Sign in"}
          </button>
        </div>
      </form>
      {mode === "login" && (
        <p className="auth-links">
          <Link href="/forgot-password">Forgot password?</Link>
          {signupOpen && <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Create an account</Link>}
        </p>
      )}
      {mode === "signup" && (
        <p className="auth-links">
          <span>
            Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</Link>
          </span>
        </p>
      )}
    </AuthShell>
  );
}
