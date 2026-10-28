import { listFriends, listRequests } from "@/lib/social/friends";
import { socialRoute } from "@/lib/social/route";

// The reader's friends, and requests both ways.
export async function GET() {
  return socialRoute(async (userId) => {
    const [friends, requests] = await Promise.all([listFriends(userId), listRequests(userId)]);
    return Response.json({ friends, requests });
  });
}
