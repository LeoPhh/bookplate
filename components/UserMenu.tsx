"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import Avatar from "./Avatar";

// The profile photo in the top-right corner of every page; it opens a small
// menu with the account's name, Settings, and Sign out.
export default function UserMenu() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const user = session?.user;

  const signOut = async () => {
    await authClient.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar image={user?.image} size={40} />
      </button>
      {open && (
        <div className="user-menu-panel" role="menu">
          {user && (
            <div className="user-menu-who">
              <span className="user-menu-name">{user.name}</span>
              <span className="user-menu-email">{user.email}</span>
            </div>
          )}
          <Link href="/settings" className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            Settings
          </Link>
          <button type="button" className="user-menu-item" role="menuitem" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
