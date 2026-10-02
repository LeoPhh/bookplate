import { timingSafeEqual } from "crypto";
import { config } from "@/lib/config";
import { currentTotals, renderMetrics } from "@/lib/metrics";

// Totals for a metrics collector (see lib/metrics.ts). Off unless
// METRICS_TOKEN is set; then readable only with
// `Authorization: Bearer <METRICS_TOKEN>`.
export async function GET(request: Request) {
  if (!config.metricsToken) return new Response("Not found", { status: 404 });
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const expected = Buffer.from(config.metricsToken);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return new Response(renderMetrics(currentTotals()), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
}
