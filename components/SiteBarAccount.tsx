"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import UserMenu from "./UserMenu";

// The site bar's right-hand corner: the account menu when signed in, or the
// ways in when not. Blank while the session loads, so nothing flickers.
export default function SiteBarAccount({ signupOpen }: { signupOpen: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <div className="sitebar-actions" />;
  if (session) {
    return (
      <div className="sitebar-actions">
        <UserMenu />
      </div>
    );
  }
  return (
    <div className="sitebar-actions">
      <Link className="btn" href="/login">
        Sign in
      </Link>
      {signupOpen && (
        <Link className="btn btn--accent" href="/signup">
          Create account
        </Link>
      )}
    </div>
  );
}
