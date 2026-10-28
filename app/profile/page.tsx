import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { ensureProfile } from "@/lib/social/profile";

// The Profile tab (SOCIAL=true servers, in Showcase's place): the reader's
// own profile page. Every reader has one; it's made here if it's missing.
export default async function ProfilePage() {
  await connection();
  if (!config.social) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await ensureProfile(session.user.id);
  redirect(`/u/${profile.handle}`);
}
