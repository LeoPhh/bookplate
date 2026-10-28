import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { ensureProfile } from "@/lib/social/profile";

// Where the Friends tab was: the reader's friends now hang off their profile.
export default async function FriendsPage() {
  await connection();
  if (!config.social) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await ensureProfile(session.user.id);
  redirect(`/u/${profile.handle}/friends`);
}
