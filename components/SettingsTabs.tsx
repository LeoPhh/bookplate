"use client";

import { useRef, type KeyboardEvent } from "react";
import type { SettingsTab } from "@/lib/settingsTabs";

// The Settings page's tab bar: labels on a rule, the open one underlined in
// the accent. A real tablist: the arrow keys (and Home/End) move between tabs.
export default function SettingsTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: SettingsTab; label: string }[];
  active: SettingsTab;
  onChange: (id: SettingsTab) => void;
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
    <div className="settings-tabs" role="tablist" aria-label="Settings" onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          type="button"
          role="tab"
          id={`settings-tab-${t.id}`}
          aria-selected={t.id === active}
          aria-controls={`settings-panel-${t.id}`}
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
