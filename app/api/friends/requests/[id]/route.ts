import { log } from "@/lib/log";
import { answerRequest, withdrawRequest } from "@/lib/social/friends";
import { badJson, isUserId, jsonBody, socialRoute } from "@/lib/social/route";

type Params = { params: Promise<{ id: string }> };

// POST { accept } answers the request this reader sent.
export async function POST(request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    const { id } = await params;
    const body = await jsonBody(request);
    if (!body) return badJson();
    if (typeof body.accept !== "boolean") return Response.json({ error: "accept must be true or false" }, { status: 400 });
    if (!isUserId(id)) return Response.json({ error: "No such request." }, { status: 404 });
    await answerRequest(userId, id, body.accept);
    void log.info(body.accept ? "friend.accepted" : "friend.declined", { user: userId, other: id });
    return Response.json({ ok: true });
  });
}

// DELETE takes back a request sent to this reader.
export async function DELETE(_request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    const { id } = await params;
    if (!isUserId(id) || !(await withdrawRequest(userId, id))) {
      return Response.json({ error: "No such request." }, { status: 404 });
    }
    void log.info("friend.withdrawn", { user: userId, other: id });
    return Response.json({ ok: true });
  });
}
