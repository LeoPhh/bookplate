import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import SiteNav from "@/components/SiteNav";
import SettingsPanel from "@/components/SettingsPanel";

export default async function SettingsPage() {
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Settings</h1>
        <p className="masthead-stats">Your account and your library&rsquo;s backups · Bookplate {config.version}</p>
        <SiteNav />
      </header>
      <SettingsPanel
        user={{ name: session.user.name, email: session.user.email, image: session.user.image ?? null }}
      />
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
