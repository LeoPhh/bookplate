// The tabs of the Settings page, in order. Each opens at /settings?tab=<id>
// (the first at plain /settings).
export const SETTINGS_TABS = [
  { id: "profile", label: "Profile" },
  { id: "data", label: "Import & export" },
  { id: "preferences", label: "Preferences" },
  { id: "security", label: "Security" },
  { id: "delete", label: "Delete account" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export const isSettingsTab = (id: unknown): id is SettingsTab => SETTINGS_TABS.some((t) => t.id === id);
