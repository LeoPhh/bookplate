import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { getDb, schema } from "@/lib/db";
import SettingsPanel from "@/components/SettingsPanel";

export default async function SettingsPage() {
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");
  const [row] = config.newsletter
    ? await getDb()
        .select({ since: schema.user.newsletterConsentAt })
        .from(schema.user)
        .where(eq(schema.user.id, session.user.id))
    : [];

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Settings</h1>
      </header>
      <SettingsPanel
        user={{ name: session.user.name, email: session.user.email, image: session.user.image ?? null }}
        email={config.email.enabled ? { from: config.email.from } : null}
        newsletter={config.newsletter ? Boolean(row?.since) : null}
      />
      <p className="settings-version">Bookplate version {config.version}</p>
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
