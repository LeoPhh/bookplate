import path from "path";
import pkg from "../package.json";

// Every setting comes from the environment, so the same image runs anywhere.
// See .env.example for the full list.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} — see .env.example`);
  return value;
}

export const config = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  // Covers and pasted note images. The Docker image points this at /data/uploads.
  uploadsDir: path.resolve(/* turbopackIgnore: true */ process.env.UPLOADS_DIR ?? "uploads"),
  // "closed": only the first account (the owner) can be created.
  // "open": anyone who can reach the server can sign up.
  registration: process.env.REGISTRATION === "open" ? ("open" as const) : ("closed" as const),
  get authSecret() {
    return required("AUTH_SECRET");
  },
  // The URL people use to reach Bookplate, e.g. https://books.example.com.
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:3000",
  version: pkg.version,
};

// Sent with every request to Open Library, iTunes and Wiktionary, which ask
// API clients to identify themselves.
export const USER_AGENT = `Bookplate/${pkg.version} (+https://github.com/LeoPhh/bookplate)`;
