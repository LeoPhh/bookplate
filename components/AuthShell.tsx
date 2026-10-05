import type { ReactNode } from "react";
import Link from "next/link";
import type { LegalLinks } from "@/lib/legal";

// A link to a legal document: inside the app, or the address it's published at.
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return href.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href}>{children}</a>;
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
          {legal.privacy && <LegalLink href={legal.privacy}>Privacy policy</LegalLink>}
          {legal.terms && <LegalLink href={legal.terms}>Terms of use</LegalLink>}
        </p>
      )}
    </main>
  );
}
