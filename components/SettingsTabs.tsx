"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

// A tab bar, on Settings and the friends page: labels on a rule, the open one
// underlined in the accent. A real tablist: the arrow keys (and Home/End) move between tabs.
export default function SettingsTabs<T extends string>({
  tabs,
  active,
  onChange,
  name = "Settings",
  idPrefix = "settings",
}: {
  tabs: readonly { id: T; label: ReactNode }[];
  active: T;
  onChange: (id: T) => void;
  name?: string;
  idPrefix?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div className="settings-tabs" role="tablist" aria-label={name} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${t.id}`}
          aria-selected={t.id === active}
          aria-controls={`${idPrefix}-panel-${t.id}`}
          tabIndex={t.id === active ? 0 : -1}
          className={t.id === active ? "settings-tab settings-tab--active" : "settings-tab"}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
