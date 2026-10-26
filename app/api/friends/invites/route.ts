import { log } from "@/lib/log";
import { createInvite, listInvites } from "@/lib/social/invites";
import { socialRoute } from "@/lib/social/route";

export async function GET() {
  return socialRoute(async (userId) => Response.json({ invites: await listInvites(userId) }));
}

// POST makes a new invite link.
export async function POST() {
  return socialRoute(async (userId) => {
    const invite = await createInvite(userId);
    // Never the token: it's the whole key.
    void log.info("friend.invite_made", { user: userId });
    return Response.json({ invite });
  });
}
