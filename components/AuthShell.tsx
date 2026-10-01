import type { ReactNode } from "react";

// The frame for every signed-out screen: sign in, setup, sign up, and the
// password-reset pages.
export default function AuthShell({ title, children }: { title: string; children: ReactNode }) {
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
    </main>
  );
}
