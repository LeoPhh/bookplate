import { log } from "@/lib/log";
import { listRequests, sendRequest } from "@/lib/social/friends";
import { badJson, jsonBody, socialRoute } from "@/lib/social/route";

export async function GET() {
  return socialRoute(async (userId) => Response.json(await listRequests(userId)));
}

// POST { handle } asks that reader to be friends. Answers { result }: "sent",
// "friends" (they'd asked first) or "already".
export async function POST(request: Request) {
  return socialRoute(async (userId) => {
    const body = await jsonBody(request);
    if (!body) return badJson();
    if (typeof body.handle !== "string") return Response.json({ error: "Which handle?" }, { status: 400 });
    const { result, to } = await sendRequest(userId, body.handle);
    // Never the handle: the account ids say who.
    void log.info("friend.requested", { user: userId, other: to, result });
    return Response.json({ result });
  });
}
