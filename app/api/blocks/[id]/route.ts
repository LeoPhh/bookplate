import { log } from "@/lib/log";
import { blockUser, unblockUser } from "@/lib/social/friends";
import { isUserId, socialRoute } from "@/lib/social/route";

type Params = { params: Promise<{ id: string }> };

// PUT blocks a reader: any friendship or request between the two ends, and
// each disappears from the other's view. They aren't told.
export async function PUT(_request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    const { id } = await params;
    if (!isUserId(id)) return Response.json({ error: "No such reader." }, { status: 404 });
    await blockUser(userId, id);
    void log.info("friend.blocked", { user: userId, other: id });
    return Response.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    const { id } = await params;
    if (!isUserId(id) || !(await unblockUser(userId, id))) return Response.json({ error: "Not blocked" }, { status: 404 });
    void log.info("friend.unblocked", { user: userId, other: id });
    return Response.json({ ok: true });
  });
}
