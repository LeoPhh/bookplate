import { describe, expect, it } from "vitest";
import { baseUrl, limitedBaseUrl, reader, Visitor } from "./client";

// The site bar (SITE_URL, SITE_LINKS): the limited server has one, the plain
// server doesn't.

describe("the site bar", () => {
  it("links back to the website on every page, signed in or not", async () => {
    await reader("Reader", limitedBaseUrl()); // so /login isn't sent to /setup
    for (const path of ["/login", "/forgot-password"]) {
      const res = await new Visitor(undefined, limitedBaseUrl()).fetch(path);
      const html = await res.text();
      expect(html).toContain('class="sitebar"');
      expect(html).toContain('href="https://site.test/"'); // the logo, and Home
      expect(html).toContain('href="https://site.test/about"');
      expect(html).toContain('href="https://docs.test/start"');
    }
    const r = await reader("Signed in", limitedBaseUrl());
    expect(await (await r.fetch("/settings")).text()).toContain('href="https://site.test/about"');
  });

  it("isn't there without SITE_URL", async () => {
    await reader("Reader", baseUrl());
    const html = await (await new Visitor(undefined, baseUrl()).fetch("/login")).text();
    expect(html).not.toContain("sitebar");
  });
});
