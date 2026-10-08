import { eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { getAuth, requireUser, setNewsletter } from "@/lib/auth";
import { config } from "@/lib/config";
import { getDb, schema } from "@/lib/db";
import { getStorage, keys } from "@/lib/storage";
import { clearThrottle, recordFailure, throttleWait } from "@/lib/authThrottle";
import { log } from "@/lib/log";

// PATCH changes the account's own settings: { newsletter: boolean }, on
// servers that offer one.
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!config.newsletter) return Response.json({ error: "There's no newsletter on this server." }, { status: 404 });
  let newsletter: unknown;
  try {
    newsletter = ((await request.json()) as { newsletter?: unknown })?.newsletter;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof newsletter !== "boolean") return Response.json({ error: "newsletter must be true or false" }, { status: 400 });
  await setNewsletter(auth.userId, newsletter);
  void log.info("account.newsletter", { user: auth.userId, newsletter });
  return Response.json({ newsletter });
}

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
  const throttleKey = `password:${auth.userId}`;
  const wait = await throttleWait(throttleKey);
  if (wait > 0) {
    return Response.json({ error: `Too many wrong passwords — try again in ${wait} minutes.` }, { status: 429 });
  }
  try {
    await getAuth().api.verifyPassword({ body: { password }, headers: await headers() });
  } catch (e) {
    if (isAPIError(e)) {
      await recordFailure(throttleKey);
      void log.info("account.delete_refused", { user: auth.userId, reason: "wrong password" });
      return Response.json({ error: "That password isn't right." }, { status: 403 });
    }
    throw e;
  }
  await clearThrottle(throttleKey);

  // Sessions, the login, books, notes and words all go with the user row
  // (foreign keys cascade); the files are removed after it.
  await getDb().delete(schema.user).where(eq(schema.user.id, auth.userId));
  await getStorage().deletePrefix(keys.userDir(auth.userId));
  void log.info("account.deleted", { user: auth.userId });
  return Response.json({ ok: true });
}
