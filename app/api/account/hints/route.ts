import { requireUser } from "@/lib/auth";
import { dismissedHints, dismissHint, isHint } from "@/lib/hints";
import { log } from "@/lib/log";

// GET lists the info boxes the reader has turned off.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ dismissed: await dismissedHints(auth.userId) });
}

// POST { hint } turns one off for good ("Don't show again").
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let hint: unknown;
  try {
    hint = ((await request.json()) as { hint?: unknown })?.hint;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isHint(hint)) return Response.json({ error: "Unknown hint" }, { status: 400 });
  const dismissed = await dismissHint(auth.userId, hint);
  void log.info("account.hint_dismissed", { user: auth.userId, hint });
  return Response.json({ dismissed });
}
