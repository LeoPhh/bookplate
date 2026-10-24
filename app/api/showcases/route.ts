import { requireUser } from "@/lib/auth";
import { log } from "@/lib/log";
import { todayIso } from "@/lib/progress";
import { getShowcase, parseShowcase, saveShowcase, ShowcaseError } from "@/lib/showcase";

// The signed-in reader's showcase (a public page of a year's reading), or
// null when it's off.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ showcase: await getShowcase(auth.userId) });
}

// POST { year, name } creates the reader's showcase, or changes it (even to
// another year) and keeps its address.
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
    void log.info("showcase.saved", { user: auth.userId, year: showcase.year });
    return Response.json({ showcase });
  } catch (e) {
    if (e instanceof ShowcaseError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
