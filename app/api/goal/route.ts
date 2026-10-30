import { todayIso } from "@/lib/progress";
import { checkGoal, clearGoal, setGoal } from "@/lib/social/goals";
import { badJson, jsonBody, socialRoute } from "@/lib/social/route";

const thisYear = () => Number(todayIso().slice(0, 4));

// PUT { books } sets the reader's goal for this year; DELETE takes it away.
export async function PUT(request: Request) {
  return socialRoute(async (userId) => {
    const body = await jsonBody(request);
    if (!body) return badJson();
    const books = checkGoal(body.books);
    await setGoal(userId, thisYear(), books);
    return Response.json({ books });
  });
}

export async function DELETE() {
  return socialRoute(async (userId) => {
    await clearGoal(userId, thisYear());
    return Response.json({ ok: true });
  });
}
