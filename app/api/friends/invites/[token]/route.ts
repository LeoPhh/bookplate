import { log } from "@/lib/log";
import { acceptInvite, revokeInvite } from "@/lib/social/invites";
import { socialRoute } from "@/lib/social/route";

type Params = { params: Promise<{ token: string }> };

// POST takes up an invite: the signed-in reader becomes the inviter's friend.
// Answers { result }: "friends", "already" or "own" (their own link).
export async function POST(_request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    const { result, inviter } = await acceptInvite(userId, (await params).token);
    void log.info("friend.invite_used", { user: userId, other: inviter, result });
    return Response.json({ result });
  });
}

// DELETE takes back one of the reader's own links: it stops working at once.
export async function DELETE(_request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    if (!(await revokeInvite(userId, (await params).token))) {
      return Response.json({ error: "No such invite" }, { status: 404 });
    }
    void log.info("friend.invite_revoked", { user: userId });
    return Response.json({ ok: true });
  });
}
