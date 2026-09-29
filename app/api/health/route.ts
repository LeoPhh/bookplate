import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";

// Used by the Docker healthcheck: the app is up and can reach its database.
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, version: config.version });
  } catch {
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
