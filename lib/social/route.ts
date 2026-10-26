import { requireUser } from "../auth";
import { FriendError } from "./errors";
import { socialOff } from "./gate";

// The start and end of every signed-in social route: "not found" without
// SOCIAL=true, 401 when signed out, and a FriendError's message as the answer.
export async function socialRoute(handler: (userId: string) => Promise<Response>): Promise<Response> {
  const off = socialOff();
  if (off) return off;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    return await handler(auth.userId);
  } catch (e) {
    if (e instanceof FriendError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

// A JSON body, or null when there isn't a readable one.
export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const badJson = () => Response.json({ error: "Invalid JSON" }, { status: 400 });

// Account ids as Better Auth makes them; anything else can't be anyone.
export const isUserId = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);
