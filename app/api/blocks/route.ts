import { listBlocked } from "@/lib/social/friends";
import { socialRoute } from "@/lib/social/route";

// The readers this reader has blocked.
export async function GET() {
  return socialRoute(async (userId) => Response.json({ blocked: await listBlocked(userId) }));
}
