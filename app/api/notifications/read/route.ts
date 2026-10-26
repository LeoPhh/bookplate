import { markAllRead } from "@/lib/social/notifications";
import { socialRoute } from "@/lib/social/route";

// POST marks every notification read, clearing the badge.
export async function POST() {
  return socialRoute(async (userId) => {
    await markAllRead(userId);
    return Response.json({ ok: true });
  });
}
