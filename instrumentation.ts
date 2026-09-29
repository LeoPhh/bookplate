// Runs once when the server starts, before it takes any requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./lib/db/migrate");
  await runMigrations();
}
