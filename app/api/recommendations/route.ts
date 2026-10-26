import { log } from "@/lib/log";
import { listInbox, listSent, parseRecommendation, sendRecommendation } from "@/lib/social/recs";
import { badJson, jsonBody, socialRoute } from "@/lib/social/route";

// What friends recommended to the reader (still to answer), and what the
// reader recommended.
export async function GET() {
  return socialRoute(async (userId) => {
    const [inbox, sent] = await Promise.all([listInbox(userId), listSent(userId)]);
    return Response.json({ inbox, sent });
  });
}

// POST { to, title, author, isbn?, olWorkId?, note? } recommends a book to a
// friend (`to` is their account id).
export async function POST(request: Request) {
  return socialRoute(async (userId) => {
    const body = await jsonBody(request);
    if (!body) return badJson();
    const rec = parseRecommendation(body);
    const id = await sendRecommendation(userId, rec);
    // Never the book or the note.
    void log.info("recommendation.sent", { user: userId, other: rec.to });
    return Response.json({ id });
  });
}
