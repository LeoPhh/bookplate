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
  // Email is optional. With SMTP_HOST set, Bookplate can send password-reset
  // links and (with open registration) verify new accounts' addresses.
  email: {
    get enabled() {
      return Boolean(process.env.SMTP_HOST);
    },
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    // Implicit TLS (port 465) vs STARTTLS (587/25); follows the port unless set.
    get secure() {
      const v = process.env.SMTP_SECURE;
      return v ? v === "true" : this.port === 465;
    },
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? "Bookplate <bookplate@localhost>",
  },
  // New accounts must confirm their address when strangers can sign up and
  // there's email to confirm it with. A single-owner server never asks.
  get requireEmailVerification() {
    return this.registration === "open" && this.email.enabled;
  },
  version: pkg.version,
};

// Sent with every request to Open Library, iTunes and Wiktionary, which ask
// API clients to identify themselves.
export const USER_AGENT = `Bookplate/${pkg.version} (+https://github.com/LeoPhh/bookplate)`;
