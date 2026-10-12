import { requireUser } from "@/lib/auth";
import { isFeature } from "@/lib/featureList";
import { getFeatures, setFeature } from "@/lib/features";
import { log } from "@/lib/log";

// GET lists the optional features the reader has switched on.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ features: await getFeatures(auth.userId) });
}

// PATCH { feature, on } switches one on or off (Settings → Optional features).
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let body: { feature?: unknown; on?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isFeature(body.feature)) return Response.json({ error: "Unknown feature" }, { status: 400 });
  if (typeof body.on !== "boolean") return Response.json({ error: "on must be true or false" }, { status: 400 });
  const features = await setFeature(auth.userId, body.feature, body.on);
  void log.info("account.feature", { user: auth.userId, feature: body.feature, on: body.on });
  return Response.json({ features });
}
