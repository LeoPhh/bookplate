// Server startup (Node.js only — instrumentation.ts loads it): migrations,
// settings checks, then the periodic housekeeping.
export async function start() {
  try {
    // Inside the try: a bad setting makes these imports throw.
    const { config } = await import("./config");
    const { log } = await import("./log");
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
    // Wrong storage settings stop the server here, with a readable reason,
    // rather than failing on the first image someone uploads.
    const { getStorage } = await import("./storage");
    await getStorage().check?.();
    // What this server is running with — the first thing to look at when
    // something behaves differently on one server than another. No secrets.
    void log.info("startup", {
      registration: config.registration,
      storage: config.storage,
      email: config.email.enabled
        ? { limitPerDay: config.email.dailyLimit || null, replyTo: Boolean(config.email.replyTo) }
        : false,
      botCheck: config.signupBotCheck,
      trustedProxies: config.trustedProxies,
      limits: config.limits,
      logLevel: config.logLevel,
      metrics: config.metricsToken ? { refreshMinutes: config.metricsRefreshMinutes } : false,
      contactForm: Boolean(config.contactTo && config.email.enabled),
      siteBar: config.site ? { links: config.site.links.length } : false,
    });
  } catch (e) {
    // Next.js would log this and keep running without serving anything;
    // exit instead, so Docker restarts it and shows it as failing.
    console.error(`Bookplate couldn't start: ${e instanceof Error ? e.message : e}`);
    try {
      const { log } = await import("./log");
      await log.error("startup.failed", { error: e });
    } catch {
      // the settings themselves are broken; the line above says why
    }
    process.exit(1);
  }
  const { startHousekeeping } = await import("./housekeeping");
  startHousekeeping();
  const { startMetrics } = await import("./metrics");
  startMetrics();
}
