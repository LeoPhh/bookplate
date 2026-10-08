import { sql } from "drizzle-orm";
import { config } from "./config";
import { getDb } from "./db";
import { log } from "./log";

// Totals for a dashboard, served at /api/metrics in Prometheus's text format
// for a collector (Grafana Alloy) to read and forward to Cockpit. Only
// totals: nothing about any one account.
//
// The database is asked every METRICS_REFRESH_MINUTES (8 hours by default)
// and at startup, and the answers kept in memory, so however often the
// collector reads, the database isn't bothered. Off unless METRICS_TOKEN is
// set.

export interface Totals {
  accounts: { confirmed: number; unconfirmed: number };
  newsletter: { confirmed: number; unconfirmed: number }; // accounts subscribed
  newAccounts: Record<"1d" | "7d" | "30d", number>;
  activeAccounts: Record<"1d" | "7d" | "30d", number>;
  books: Record<string, number>; // by status
  booksPerAccount: { p50: number; p90: number; max: number }; // among accounts with books
  notes: number;
  words: number;
  progressEntries: number;
  collectedAt: number; // ms since epoch
}

// On globalThis: Next.js loads the startup code (which counts) and the
// route (which reports) as separate copies of this module.
const g = globalThis as unknown as { bookplateTotals?: Totals };

const num = (v: unknown) => Number(v ?? 0);

async function one(query: ReturnType<typeof sql>): Promise<Record<string, unknown>> {
  return (await getDb().execute(query)).rows[0] ?? {};
}

export async function collectTotals(): Promise<Totals> {
  const db = getDb();
  const accounts = await one(sql`
    SELECT count(*) FILTER (WHERE email_verified) AS confirmed,
           count(*) FILTER (WHERE NOT email_verified) AS unconfirmed,
           count(*) FILTER (WHERE newsletter_consent_at IS NOT NULL AND email_verified) AS newsletter_confirmed,
           count(*) FILTER (WHERE newsletter_consent_at IS NOT NULL AND NOT email_verified) AS newsletter_unconfirmed,
           count(*) FILTER (WHERE created_at > localtimestamp - interval '1 day') AS new_1d,
           count(*) FILTER (WHERE created_at > localtimestamp - interval '7 days') AS new_7d,
           count(*) FILTER (WHERE created_at > localtimestamp - interval '30 days') AS new_30d
    FROM "user"`);
  // A session's updated_at moves when it's used (at most daily), so this is
  // "signed in or used Bookplate within the period", approximately.
  const active = await one(sql`
    SELECT count(DISTINCT user_id) FILTER (WHERE updated_at > localtimestamp - interval '1 day') AS d1,
           count(DISTINCT user_id) FILTER (WHERE updated_at > localtimestamp - interval '7 days') AS d7,
           count(DISTINCT user_id) FILTER (WHERE updated_at > localtimestamp - interval '30 days') AS d30
    FROM session`);
  const byStatus = (await db.execute(sql`SELECT status, count(*) AS n FROM book GROUP BY status`)).rows;
  const perAccount = await one(sql`
    SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY n) AS p50,
           percentile_disc(0.9) WITHIN GROUP (ORDER BY n) AS p90,
           max(n) AS max
    FROM (SELECT count(*) AS n FROM book GROUP BY user_id) per_account`);
  const rest = await one(sql`
    SELECT (SELECT count(*) FROM note) AS notes,
           (SELECT count(*) FROM vocab_entry) AS words,
           (SELECT count(*) FROM reading_progress) AS progress`);

  return {
    accounts: { confirmed: num(accounts.confirmed), unconfirmed: num(accounts.unconfirmed) },
    newsletter: { confirmed: num(accounts.newsletter_confirmed), unconfirmed: num(accounts.newsletter_unconfirmed) },
    newAccounts: { "1d": num(accounts.new_1d), "7d": num(accounts.new_7d), "30d": num(accounts.new_30d) },
    activeAccounts: { "1d": num(active.d1), "7d": num(active.d7), "30d": num(active.d30) },
    books: Object.fromEntries(byStatus.map((r) => [String(r.status), num(r.n)])),
    booksPerAccount: { p50: num(perAccount.p50), p90: num(perAccount.p90), max: num(perAccount.max) },
    notes: num(rest.notes),
    words: num(rest.words),
    progressEntries: num(rest.progress),
    collectedAt: Date.now(),
  };
}

async function refresh(): Promise<void> {
  const started = Date.now();
  try {
    g.bookplateTotals = await collectTotals();
    void log.debug("metrics.collected", { ms: Date.now() - started });
  } catch (e) {
    void log.error("metrics.failed", { error: e });
  }
}

export function startMetrics(): void {
  if (!config.metricsToken) return;
  void refresh();
  setInterval(refresh, config.metricsRefreshMinutes * 60 * 1000).unref();
}

// ── Prometheus text format ──────────────────────────────────────────────

type Sample = [labels: Record<string, string>, value: number];

function metric(name: string, help: string, samples: Sample[], type = "gauge"): string {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`];
  for (const [labels, value] of samples) {
    const l = Object.entries(labels).map(([k, v]) => `${k}="${v.replace(/["\\\n]/g, "_")}"`);
    lines.push(`${name}${l.length ? `{${l.join(",")}}` : ""} ${value}`);
  }
  return lines.join("\n");
}

const periods = (r: Record<string, number>): Sample[] => Object.entries(r).map(([period, v]) => [{ period }, v]);

export function renderMetrics(totals: Totals | null, version = config.version): string {
  const mem = process.memoryUsage();
  const parts = [
    metric("bookplate_info", "The running version", [[{ version }, 1]]),
    metric("bookplate_process_resident_memory_bytes", "Memory used by the server process", [[{}, mem.rss]]),
    metric("bookplate_process_heap_used_bytes", "JavaScript heap in use", [[{}, mem.heapUsed]]),
    metric("bookplate_process_uptime_seconds", "Seconds since the server started", [[{}, Math.round(process.uptime())]]),
  ];
  if (totals) {
    parts.push(
      metric("bookplate_totals_collected_timestamp_seconds", "When these totals were last counted", [
        [{}, Math.round(totals.collectedAt / 1000)],
      ]),
      metric("bookplate_accounts", "Accounts, by whether their email address is confirmed", [
        [{ confirmed: "true" }, totals.accounts.confirmed],
        [{ confirmed: "false" }, totals.accounts.unconfirmed],
      ]),
      metric("bookplate_newsletter_accounts", "Accounts subscribed to the newsletter, by whether their email address is confirmed", [
        [{ confirmed: "true" }, totals.newsletter.confirmed],
        [{ confirmed: "false" }, totals.newsletter.unconfirmed],
      ]),
      metric("bookplate_new_accounts", "Accounts created within the period", periods(totals.newAccounts)),
      metric("bookplate_active_accounts", "Accounts that used Bookplate within the period (approximate)", periods(totals.activeAccounts)),
      metric("bookplate_books", "Books, by status", Object.entries(totals.books).map(([status, v]) => [{ status }, v])),
      metric("bookplate_books_per_account", "Books per account, among accounts with any", [
        [{ quantile: "0.5" }, totals.booksPerAccount.p50],
        [{ quantile: "0.9" }, totals.booksPerAccount.p90],
        [{ quantile: "1" }, totals.booksPerAccount.max],
      ]),
      metric("bookplate_notes", "Books with notes", [[{}, totals.notes]]),
      metric("bookplate_words", "Vocabulary words saved", [[{}, totals.words]]),
      metric("bookplate_progress_entries", "Reading-progress updates logged", [[{}, totals.progressEntries]])
    );
  }
  return parts.join("\n") + "\n";
}

export const currentTotals = () => g.bookplateTotals ?? null;
