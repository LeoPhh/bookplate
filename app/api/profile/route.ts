import { requireUser } from "@/lib/auth";
import { log } from "@/lib/log";
import { socialOff } from "@/lib/social/gate";
import { deleteProfile, getProfile, parseProfile, ProfileError, saveProfile } from "@/lib/social/profile";

// The signed-in reader's profile (lib/social/profile.ts), or null when they
// haven't made one.
export async function GET() {
  const off = socialOff();
  if (off) return off;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ profile: await getProfile(auth.userId) });
}

// PATCH { handle?, bio?, visibility?, shareReading?, shareRatings? } makes the
// profile (a handle is needed the first time) or changes any of it.
export async function PATCH(request: Request) {
  const off = socialOff();
  if (off) return off;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const profile = await saveProfile(auth.userId, parseProfile(body));
    // Never the handle or the bio.
    void log.info("profile.saved", { user: auth.userId, visibility: profile.visibility });
    return Response.json({ profile });
  } catch (e) {
    if (e instanceof ProfileError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

// DELETE removes the profile: nobody else sees anything any more.
export async function DELETE() {
  const off = socialOff();
  if (off) return off;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  await deleteProfile(auth.userId);
  void log.info("profile.removed", { user: auth.userId });
  return Response.json({ ok: true });
}
