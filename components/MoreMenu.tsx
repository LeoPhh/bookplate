"use client";

import { useEffect, useRef, useState } from "react";

// A ⋯ button that opens a small menu, for what shouldn't sit among the everyday
// buttons (blocking, reporting, unfriending). `children` gets a way to close it.
export default function MoreMenu({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div className={open ? "profile-menu profile-menu--open" : "profile-menu"} ref={menu}>
      <button
        type="button"
        className="btn profile-menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="2" cy="7" r="1.5" />
          <circle cx="7" cy="7" r="1.5" />
          <circle cx="12" cy="7" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="user-menu-panel profile-menu-panel" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
