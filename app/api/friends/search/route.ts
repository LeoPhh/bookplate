import { NextRequest } from "next/server";
import { searchPeople } from "@/lib/social/friends";
import { socialRoute } from "@/lib/social/route";

// GET ?q= finds readers to add by name or username, with where each stands
// with this reader.
export async function GET(request: NextRequest) {
  return socialRoute(async (userId) => Response.json({ results: await searchPeople(userId, request.nextUrl.searchParams.get("q") ?? "") }));
}
