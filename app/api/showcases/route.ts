import { requireUser } from "@/lib/auth";
import { log } from "@/lib/log";
import { todayIso } from "@/lib/progress";
import { listShowcases, parseShowcase, saveShowcase, ShowcaseError } from "@/lib/showcase";

// The signed-in reader's showcases (public pages of a year's reading).
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ showcases: await listShowcases(auth.userId) });
}

// POST { year, include: "both" | "read" | "reading", name } creates that
// year's showcase, or changes it and keeps its address.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const showcase = await saveShowcase(auth.userId, parseShowcase(body, Number(todayIso().slice(0, 4))));
    // Never the address or the name: the address is the only key to the page.
    void log.info("showcase.saved", { user: auth.userId, year: showcase.year, include: showcase.include });
    return Response.json({ showcase });
  } catch (e) {
    if (e instanceof ShowcaseError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
