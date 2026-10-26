import { listNotifications, unreadCount } from "@/lib/social/notifications";
import { socialRoute } from "@/lib/social/route";

// The reader's latest notifications, newest first, and how many are unread.
export async function GET() {
  return socialRoute(async (userId) => {
    const [notifications, unread] = await Promise.all([listNotifications(userId), unreadCount(userId)]);
    return Response.json({ notifications, unread });
  });
}
