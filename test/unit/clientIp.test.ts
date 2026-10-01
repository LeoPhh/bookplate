import { afterEach, describe, expect, it, vi } from "vitest";

const ipFor = async (xff: string | null, proxies?: string) => {
  vi.resetModules();
  if (proxies === undefined) delete process.env.TRUSTED_PROXIES;
  else process.env.TRUSTED_PROXIES = proxies;
  const { clientIp } = await import("@/lib/clientIp");
  return clientIp(new Headers(xff === null ? {} : { "x-forwarded-for": xff }));
};

describe("clientIp", () => {
  afterEach(() => delete process.env.TRUSTED_PROXIES);

  it("takes the address the nearest proxy added, ignoring made-up ones before it", async () => {
    expect(await ipFor("203.0.113.7")).toBe("203.0.113.7");
    expect(await ipFor("1.1.1.1, 2.2.2.2, 203.0.113.7")).toBe("203.0.113.7");
  });

  it("looks one further in for each extra proxy", async () => {
    expect(await ipFor("1.1.1.1, 203.0.113.7, 10.0.0.2", "2")).toBe("203.0.113.7");
    expect(await ipFor("203.0.113.7", "2")).toBe("203.0.113.7");
  });

  it("copes with no header", async () => {
    expect(await ipFor(null)).toBe("unknown");
  });
});
