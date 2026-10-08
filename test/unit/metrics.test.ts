import { afterEach, describe, expect, it, vi } from "vitest";
import { renderMetrics, type Totals } from "@/lib/metrics";

const totals: Totals = {
  accounts: { confirmed: 412, unconfirmed: 23 },
  newsletter: { confirmed: 97, unconfirmed: 4 },
  newAccounts: { "1d": 3, "7d": 19, "30d": 80 },
  activeAccounts: { "1d": 57, "7d": 168, "30d": 301 },
  books: { read: 18233, reading: 611, "to-read": 9402 },
  booksPerAccount: { p50: 41, p90: 210, max: 1900 },
  notes: 2210,
  words: 5120,
  progressEntries: 7001,
  collectedAt: 1_790_000_000_000,
};

describe("metrics output", () => {
  it("is Prometheus text, with help and type for every metric", () => {
    const text = renderMetrics(totals, "9.9.9");
    expect(text).toContain('bookplate_info{version="9.9.9"} 1');
    expect(text).toContain('bookplate_accounts{confirmed="true"} 412');
    expect(text).toContain('bookplate_newsletter_accounts{confirmed="true"} 97');
    expect(text).toContain('bookplate_active_accounts{period="7d"} 168');
    expect(text).toContain('bookplate_books{status="to-read"} 9402');
    expect(text).toContain('bookplate_books_per_account{quantile="0.9"} 210');
    expect(text).toContain("bookplate_totals_collected_timestamp_seconds 1790000000");
    const names = [...text.matchAll(/^(bookplate_\w+)[{ ]/gm)].map((m) => m[1]);
    for (const name of new Set(names)) {
      expect(text).toContain(`# HELP ${name} `);
      expect(text).toContain(`# TYPE ${name} gauge`);
    }
    expect(text.endsWith("\n")).toBe(true);
  });

  it("still reports the server itself before the first count", () => {
    const text = renderMetrics(null);
    expect(text).toContain("bookplate_process_resident_memory_bytes");
    expect(text).not.toContain("bookplate_accounts");
  });
});

describe("METRICS_REFRESH_MINUTES", () => {
  const load = async (value?: string) => {
    vi.resetModules();
    if (value === undefined) delete process.env.METRICS_REFRESH_MINUTES;
    else process.env.METRICS_REFRESH_MINUTES = value;
    return (await import("@/lib/config")).config.metricsRefreshMinutes;
  };
  afterEach(() => delete process.env.METRICS_REFRESH_MINUTES);

  it("defaults to 8 hours", async () => {
    expect(await load()).toBe(480);
  });

  it("takes a whole number of minutes", async () => {
    expect(await load("5")).toBe(5);
  });

  it("refuses zero or anything else at startup", async () => {
    await expect(load("0")).rejects.toThrow(/at least 1/);
    await expect(load("5m")).rejects.toThrow(/whole number/);
  });
});
