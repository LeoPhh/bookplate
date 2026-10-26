import { log } from "@/lib/log";
import { unfriend } from "@/lib/social/friends";
import { isUserId, socialRoute } from "@/lib/social/route";

// DELETE ends a friendship. The other reader isn't told.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return socialRoute(async (userId) => {
    const { id } = await params;
    if (!isUserId(id) || !(await unfriend(userId, id))) return Response.json({ error: "Not friends" }, { status: 404 });
    void log.info("friend.removed", { user: userId, other: id });
    return Response.json({ ok: true });
  });
}
