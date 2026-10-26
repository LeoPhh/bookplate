import { listFriends, listRequests } from "@/lib/social/friends";
import { listInvites } from "@/lib/social/invites";
import { socialRoute } from "@/lib/social/route";

// The reader's friends, requests both ways, and invite links still working.
export async function GET() {
  return socialRoute(async (userId) => {
    const [friends, requests, invites] = await Promise.all([listFriends(userId), listRequests(userId), listInvites(userId)]);
    return Response.json({ friends, requests, invites });
  });
}
