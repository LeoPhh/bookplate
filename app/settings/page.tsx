import { and, eq, isNotNull, sql } from "drizzle-orm";
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

  // Showcase years: this one, and any with a finished book.
  const thisYear = new Date().getFullYear();
  const finished = await getDb()
    .selectDistinct({ year: sql<string>`substr(${schema.book.dateRead}, 1, 4)` })
    .from(schema.book)
    .where(and(eq(schema.book.userId, session.user.id), eq(schema.book.status, "read"), isNotNull(schema.book.dateRead)));
  const showcaseYears = [...new Set([thisYear, ...finished.map((r) => Number(r.year))])]
    .filter((y) => Number.isInteger(y) && y >= 1900 && y <= thisYear)
    .sort((a, b) => b - a);

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
        showcaseYears={showcaseYears}
      />
      <p className="settings-version">Bookplate version {config.version}</p>
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
