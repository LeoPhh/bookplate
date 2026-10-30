"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { avatarColorIndex } from "@/lib/avatar";
import Avatar from "./Avatar";

export interface AccountPicture {
  image: string | null;
  label: string; // their name, or else their username, or else their email
  username: string | null;
  color: number;
}

// The profile picture in the top-right corner of every page; it opens a small
// menu with the account's name, Settings, and Sign out. It starts from what the
// server knew and follows the session, so changes in Settings show at once.
export default function UserMenu({ initial }: { initial: AccountPicture | null }) {
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

  const user = session?.user as (NonNullable<typeof session>["user"] & { avatarColor?: number | null }) | undefined;
  const picture = user
    ? {
        image: user.image ?? null,
        label: user.name || initial?.username || user.email,
        color: avatarColorIndex(user.id, user.avatarColor),
      }
    : initial;

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
        <Avatar image={picture?.image} label={picture?.label} color={picture?.color} size={40} />
      </button>
      {open && (
        <div className="user-menu-panel" role="menu">
          {user && (
            <div className="user-menu-who">
              {user.name && <span className="user-menu-name">{user.name}</span>}
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
