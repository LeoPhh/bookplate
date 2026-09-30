import { eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { getAuth, requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getStorage, keys } from "@/lib/storage";

// DELETE permanently removes the signed-in account and everything in it.
// The password is always required, even for a fresh session, so a stolen
// cookie alone can't wipe a library. (Better Auth's own delete endpoint
// skips the password for recent sessions, so it stays switched off.)
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let password: unknown;
  try {
    password = ((await request.json()) as { password?: unknown })?.password;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof password !== "string" || !password) {
    return Response.json({ error: "Enter your password to delete your account." }, { status: 400 });
  }
  try {
    await getAuth().api.verifyPassword({ body: { password }, headers: await headers() });
  } catch (e) {
    if (isAPIError(e)) return Response.json({ error: "That password isn't right." }, { status: 403 });
    throw e;
  }

  // Sessions, the login, books, notes and words all go with the user row
  // (foreign keys cascade); the files are removed after it.
  await getDb().delete(schema.user).where(eq(schema.user.id, auth.userId));
  await getStorage().deletePrefix(keys.userDir(auth.userId));
  return Response.json({ ok: true });
}
