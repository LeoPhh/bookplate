import { listRequests } from "@/lib/social/friends";
import { listNotifications, unreadCount } from "@/lib/social/notifications";
import { socialRoute } from "@/lib/social/route";

// The reader's latest notifications, newest first, how many are unread, and the
// friend requests waiting for an answer.
export async function GET() {
  return socialRoute(async (userId) => {
    const [notifications, unread, requests] = await Promise.all([listNotifications(userId), unreadCount(userId), listRequests(userId)]);
    return Response.json({ notifications, unread, incoming: requests.incoming });
  });
}
