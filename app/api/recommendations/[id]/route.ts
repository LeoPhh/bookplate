import { log } from "@/lib/log";
import { addRecommendation, dismissRecommendation, withdrawRecommendation } from "@/lib/social/recs";
import { badJson, jsonBody, socialRoute } from "@/lib/social/route";

type Params = { params: Promise<{ id: string }> };

// PATCH { action: "add" | "dismiss" } answers a recommendation: "add" puts
// the book on the reader's to-read shelf (answering { bookId }), "dismiss"
// says it's not for them.
export async function PATCH(request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    const { id } = await params;
    const body = await jsonBody(request);
    if (!body) return badJson();
    if (body.action === "add") {
      const bookId = await addRecommendation(userId, id);
      void log.info("recommendation.added", { user: userId });
      return Response.json({ bookId });
    }
    if (body.action === "dismiss") {
      await dismissRecommendation(userId, id);
      void log.info("recommendation.dismissed", { user: userId });
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'action must be "add" or "dismiss"' }, { status: 400 });
  });
}

// DELETE takes back a recommendation the reader sent, while it's unanswered.
export async function DELETE(_request: Request, { params }: Params) {
  return socialRoute(async (userId) => {
    if (!(await withdrawRecommendation(userId, (await params).id))) {
      return Response.json({ error: "No such recommendation." }, { status: 404 });
    }
    void log.info("recommendation.withdrawn", { user: userId });
    return Response.json({ ok: true });
  });
}
