// Runs once when the server starts, before it takes any requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { runMigrations } = await import("./lib/db/migrate");
    await runMigrations();
    // Wrong storage settings stop the server here, with a readable reason,
    // rather than failing on the first image someone uploads.
    const { getStorage } = await import("./lib/storage");
    await getStorage().check?.();
  } catch (e) {
    // Next.js would log this and keep running without serving anything;
    // exit instead, so Docker restarts it and shows it as failing.
    console.error(`Bookplate couldn't start: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  const { startHousekeeping } = await import("./lib/housekeeping");
  startHousekeeping();
}
