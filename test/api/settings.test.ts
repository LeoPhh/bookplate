import { describe, expect, it } from "vitest";
import { limitedBaseUrl, reader } from "./client";

// The Settings page's tabs (lib/settingsTabs.ts).

const selected = (html: string) => html.match(/aria-selected="true"[^>]*id="settings-tab-(\w+)"|id="settings-tab-(\w+)"[^>]*aria-selected="true"/)?.slice(1).find(Boolean);

describe("settings tabs", () => {
  it("open on Profile, or on the tab the address names", async () => {
    const r = await reader();
    expect(selected(await (await r.fetch("/settings")).text())).toBe("profile");
    const html = await (await r.fetch("/settings?tab=security")).text();
    expect(selected(html)).toBe("security");
    // Every tab is on the page; only the chosen one shows.
    expect(html).toMatch(/id="settings-panel-security"(?![^>]*hidden)/);
    expect(html).toMatch(/id="settings-panel-profile"[^>]*hidden/);
    expect(html).toContain("Change password");
    expect(selected(await (await r.fetch("/settings?tab=nonsense")).text())).toBe("profile");
  });
});

describe("the Email section", () => {
  it("shows by default", async () => {
    const r = await reader();
    expect(await (await r.fetch("/settings?tab=security")).text()).toContain("Email isn’t set up");
  });

  it("is gone, with its test email, with EMAIL_SETTINGS=false (the limited server)", async () => {
    const r = await reader("Reader", limitedBaseUrl());
    const html = await (await r.fetch("/settings?tab=security")).text();
    expect(html).toContain("Change password");
    expect(html).not.toContain("Email isn’t set up");
    expect((await r.fetch("/api/email/test", { method: "POST" })).status).toBe(404);
  });
});
