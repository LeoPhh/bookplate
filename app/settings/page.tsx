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
        <SiteNav />
      </header>
      <SettingsPanel
        user={{ name: session.user.name, email: session.user.email, image: session.user.image ?? null }}
      />
      <p className="settings-version">Bookplate version {config.version}</p>
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
