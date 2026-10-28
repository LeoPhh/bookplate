import { requireUser } from "@/lib/auth";
import { log } from "@/lib/log";
import { socialOff } from "@/lib/social/gate";
import { ensureProfile, parseProfile, ProfileError, saveProfile } from "@/lib/social/profile";

// The signed-in reader's profile (lib/social/profile.ts).
export async function GET() {
  const off = socialOff();
  if (off) return off;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ profile: await ensureProfile(auth.userId) });
}

// PATCH { handle?, bio?, visibility?, shareReading?, shareRatings? } changes
// any of it.
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

