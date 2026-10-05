import BackLink from "./BackLink";
import { notFound, redirect } from "next/navigation";
import { legalDoc, legalElsewhere, type LegalDoc } from "@/lib/legal";

// /privacy and /terms: the server's own documents (see lib/legal.ts), open to
// everyone, signed in or not. A document published elsewhere is sent there.
export default function LegalPage({ name }: { name: LegalDoc }) {
  const elsewhere = legalElsewhere(name);
  if (elsewhere) redirect(elsewhere);
  const doc = legalDoc(name);
  if (!doc) notFound();
  return (
    <main className="page legal-page">
      <header className="masthead">
        <p className="masthead-eyebrow">{name === "privacy" ? "Privacy" : "Terms"}</p>
        <h1 className="masthead-title legal-title">{doc.title}</h1>
      </header>
      {/* Rendered from the operator's Markdown with raw HTML disabled. */}
      <article className="legal-body" dangerouslySetInnerHTML={{ __html: doc.html }} />
      <p className="legal-back">
        <BackLink href="/">Back</BackLink>
      </p>
    </main>
  );
}
