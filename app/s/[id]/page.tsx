import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { config } from "@/lib/config";
import { showcaseOwner } from "@/lib/showcase";
import { getProfile } from "@/lib/social/profile";

// An old showcase link (lib/showcase.ts). It leads to its reader's profile if
// they show their reading to everyone. Otherwise "not found": a showcase could
// carry a name of its own, so its address mustn't tie that to their account.
export default async function OldShowcaseLink({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  if (!config.social) notFound();
  const owner = await showcaseOwner((await params).id);
  const profile = owner ? await getProfile(owner) : null;
  if (profile?.visibility !== "public") notFound();
  redirect(`/u/${profile.handle}`);
}
