import { describe, expect, it } from "vitest";
import { reader, Visitor } from "./client";

// The bar across the top of every page (components/AppBar.tsx).

describe("the app bar", () => {
  it("shows the sections and the account menu only when signed in", async () => {
    const r = await reader();
    const html = await (await r.fetch("/settings")).text();
    expect(html).toContain('class="appbar"');
    for (const href of ['href="/"', 'href="/vocabulary"', 'href="/statistics"']) expect(html).toContain(href);
    expect(html).toContain('aria-label="Account menu"');

    const out = await (await new Visitor().fetch("/login")).text();
    expect(out).toContain('class="appbar"');
    expect(out).not.toContain('href="/vocabulary"');
    expect(out).not.toContain('aria-label="Account menu"');
  });

  it("has a mark that links to the Library, so nothing leaves the app", async () => {
    const html = await (await new Visitor().fetch("/login")).text();
    const logo = html.match(/<a\b[^>]*class="appbar-logo"[^>]*>/)?.[0] ?? "";
    expect(logo).toMatch(/href="\/"/);
    expect(html).not.toContain("bookplate.eu");
  });
});
