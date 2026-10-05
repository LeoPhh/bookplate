import { readFileSync, statSync } from "fs";
import path from "path";
import MarkdownIt from "markdown-it";
import { config } from "./config";

// The server's own privacy policy and terms (LEGAL_DIR/privacy.md and
// terms.md), written in Markdown by whoever runs it. Read on each request, so
// edits show without a restart. Raw HTML in the files is shown as text. A
// server can instead publish a document elsewhere (PRIVACY_URL, TERMS_URL):
// the links and /privacy, /terms then lead there.

export type LegalDoc = "privacy" | "terms";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function file(name: LegalDoc): string | null {
  if (!config.legalDir) return null;
  const p = path.join(config.legalDir, `${name}.md`);
  try {
    return statSync(p).isFile() ? p : null;
  } catch {
    return null;
  }
}

// Where a document is published if it's not in this app, else null.
export function legalElsewhere(name: LegalDoc): string | null {
  return (name === "privacy" ? config.privacyUrl : config.termsUrl) || null;
}

// Where to send readers for each document this server has: its own page, or
// the address it's published at. A missing key means there is no such document.
export interface LegalLinks {
  privacy?: string;
  terms?: string;
}

export function legalLinks(): LegalLinks {
  const href = (name: LegalDoc) => legalElsewhere(name) ?? (file(name) ? `/${name}` : undefined);
  return { privacy: href("privacy"), terms: href("terms") };
}

export function legalDoc(name: LegalDoc): { title: string; html: string; updated: Date } | null {
  const p = file(name);
  if (!p) return null;
  const source = readFileSync(p, "utf8");
  // The first "# Heading" is the page title; the rest is the body.
  const heading = source.match(/^#\s+(.+)$/m);
  const title = heading?.[1].trim() ?? (name === "privacy" ? "Privacy policy" : "Terms of use");
  const body = heading ? source.replace(heading[0], "") : source;
  return { title, html: md.render(body), updated: statSync(p).mtime };
}
