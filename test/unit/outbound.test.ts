import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("pacing requests to outside services", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => vi.useRealTimers());

  it("spaces requests out and turns away ones that would wait too long", async () => {
    const { pace, BusyError } = await import("@/lib/outbound");
    const started: number[] = [];
    const t0 = Date.now();
    const go = () => pace("coversByIsbn", 7_000).then(() => started.push(Date.now() - t0));
    const runs = [go(), go(), go()];
    await expect(pace("coversByIsbn", 7_000)).rejects.toBeInstanceOf(BusyError); // a 4th would wait 9 s
    await vi.runAllTimersAsync();
    await Promise.all(runs);
    expect(started).toEqual([0, 3_000, 6_000]);
  });

  it("allows Open Library three requests a second with a contact email, one without", async () => {
    for (const [email, gap] of [["", 1_000], ["books@example.com", 350]] as const) {
      vi.resetModules();
      process.env.CONTACT_EMAIL = email;
      const { pace } = await import("@/lib/outbound");
      const t0 = Date.now();
      await pace("openlibrary", 5_000);
      const second = pace("openlibrary", 5_000).then(() => Date.now() - t0);
      await vi.runAllTimersAsync();
      expect(await second).toBe(gap);
    }
    delete process.env.CONTACT_EMAIL;
  });
});
