import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import ProfileForm from "@/components/ProfileForm";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { getShowcase } from "@/lib/showcase";
import { getProfile, HANDLE_MAX, HANDLE_MIN } from "@/lib/social/profile";

// The Profile tab (SOCIAL=true servers, in Showcase's place): the reader's
// own profile page, or, before they have one, a way to make it. Someone with
// a showcase is offered a public profile, which their showcase link then
// leads to.

// "Ada Lovelace" → "ada_lovelace"; too short or nothing usable → "".
function handleFrom(name: string): string {
  const h = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX);
  return h.length >= HANDLE_MIN ? h : "";
}

export default async function ProfilePage() {
  await connection();
  if (!config.social) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, showcase] = await Promise.all([getProfile(session.user.id), getShowcase(session.user.id)]);
  if (profile) redirect(`/u/${profile.handle}`);

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Profile</h1>
      </header>
      <section className="settings-section profile-setup">
        <h2 className="promo-heading">Make your profile</h2>
        <p className="settings-lede">
          {showcase
            ? "Your profile takes over from your showcase: your reading in numbers, what you finished lately and a year in books. Make it public and your showcase link leads here."
            : "Your reading in numbers, what you’re reading now and what you finished lately, for your friends to see — or anyone, if you like. You decide what’s on it."}
        </p>
        <ProfileForm
          initial={null}
          suggested={{ handle: handleFrom(showcase?.name ?? session.user.name), visibility: showcase ? "public" : "friends" }}
        />
      </section>
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
