import type { Instrumentation } from "next";

// Runs once when the server starts, before it takes any requests.
export async function register() {
  // Kept in its own module: this file is also built for the Edge runtime,
  // which has no process.exit or database drivers.
  if (process.env.NEXT_RUNTIME === "nodejs") await (await import("./lib/startup")).start();
}

// Every error a page or API route throws ends up here, with the request it
// belonged to (Next.js also prints its own plain-text copy).
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log, REQUEST_ID_HEADER } = await import("./lib/log");
  const header = request.headers[REQUEST_ID_HEADER];
  await log.error("request.failed", {
    req: Array.isArray(header) ? header[0] : header,
    method: request.method,
    path: request.path.split("?")[0], // the query can hold search terms
    route: context.routePath,
    routeType: context.routeType,
    error,
  });
};
