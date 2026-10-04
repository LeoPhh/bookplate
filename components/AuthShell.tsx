import type { ReactNode } from "react";
import Link from "next/link";

// Which of the server's legal documents exist (LEGAL_DIR), for the links.
export interface LegalLinks {
  privacy: boolean;
  terms: boolean;
}

// The frame for every signed-out screen: sign in, setup, sign up, and the
// password-reset pages.
export default function AuthShell({ title, children, legal }: { title: string; children: ReactNode; legal?: LegalLinks }) {
  return (
    <main className="page auth-page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Bookplate</h1>
      </header>
      <div className="dialog auth-card">
        <h2 className="form-heading">{title}</h2>
        {children}
      </div>
      {legal && (legal.privacy || legal.terms) && (
        <p className="auth-legal">
          {legal.privacy && <Link href="/privacy">Privacy policy</Link>}
          {legal.terms && <Link href="/terms">Terms of use</Link>}
        </p>
      )}
    </main>
  );
}
