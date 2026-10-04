import path from "path";
import pkg from "../package.json";

// Every setting comes from the environment, so the same image runs anywhere.
// See .env.example for the full list.

const MB = 1024 * 1024;

// A whole-number setting; anything else is a startup error, not a silent default.
function limit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a whole number, not "${raw}".`);
  return n;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} — see .env.example`);
  return value;
}

export const config = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  // Where covers, pasted note images and profile photos live: files on disk
  // (the default) or an S3-compatible bucket (STORAGE=s3).
  get storage() {
    const driver = process.env.STORAGE || "local";
    if (driver !== "local" && driver !== "s3") throw new Error(`STORAGE must be "local" or "s3", not "${driver}".`);
    return driver as "local" | "s3";
  },
  // A folder with privacy.md and/or terms.md, shown at /privacy and /terms
  // and linked from the sign-in and sign-up pages. Unset = no such pages.
  legalDir: process.env.LEGAL_DIR ? path.resolve(/* turbopackIgnore: true */ process.env.LEGAL_DIR) : "",
  // With STORAGE=local. The Docker image points this at /data/uploads.
  uploadsDir: path.resolve(/* turbopackIgnore: true */ process.env.UPLOADS_DIR ?? "uploads"),
  // With STORAGE=s3: any S3-compatible provider (Scaleway, Cloudflare R2,
  // Backblaze B2, AWS, or a NAS running Garage/RustFS…).
  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined, // e.g. https://s3.fr-par.scw.cloud; unset = AWS
    region: process.env.S3_REGION || "us-east-1",
    get bucket() {
      return required("S3_BUCKET");
    },
    get accessKeyId() {
      return required("S3_ACCESS_KEY_ID");
    },
    get secretAccessKey() {
      return required("S3_SECRET_ACCESS_KEY");
    },
    // Bucket in the path (https://host/bucket/key) rather than the hostname —
    // what self-hosted servers usually need.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    // Optional folder inside the bucket, to share one bucket with other apps.
    prefix: (process.env.S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "").replace(/(.+)/, "$1/"),
  },
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
    // Where replies to Bookplate's emails go, e.g. a support inbox, when
    // SMTP_FROM is an address nobody reads. Unset = replies go to SMTP_FROM.
    replyTo: address("SMTP_REPLY_TO"),
    // At most this many emails a day (UTC) from the whole server, as a safety
    // net against abuse running up a bill or a sender reputation. 0 = no cap.
    dailyLimit: limit("EMAIL_LIMIT_PER_DAY", 0),
  },
  // Limits for each account, mostly for servers where strangers can sign up.
  // Unset (or 0) means no limit, except where a default is given.
  limits: {
    books: limit("LIMIT_BOOKS", 0),
    words: limit("LIMIT_WORDS", 0),
    storageBytes: limit("LIMIT_STORAGE_MB", 0) * MB, // all of one account's images together
    uploadBytes: limit("LIMIT_UPLOAD_MB", 8) * MB, // one cover or pasted image
    importBytes: limit("LIMIT_IMPORT_MB", 1024) * MB, // one export zip or CSV file
  },
  // Sign-ups must pass an invisible proof-of-work check, so scripts can't
  // create accounts in bulk. Only matters with open registration.
  get signupBotCheck() {
    return this.registration === "open" && process.env.SIGNUP_BOT_CHECK !== "false";
  },
  // How many reverse proxies (Caddy, nginx, a cloud load balancer…) stand in
  // front of Bookplate, to find a visitor's real address in X-Forwarded-For.
  trustedProxies: Math.max(1, limit("TRUSTED_PROXIES", 1)),
  // New accounts must confirm their address when strangers can sign up and
  // there's email to confirm it with. A single-owner server never asks.
  get requireEmailVerification() {
    return this.registration === "open" && this.email.enabled;
  },
  version: pkg.version,
  // Switches on /api/metrics (lib/metrics.ts): totals for a dashboard, read
  // with this token. Unset = off.
  metricsToken: metricsToken(),
  // How often those totals are recounted from the database, in minutes.
  metricsRefreshMinutes: metricsRefreshMinutes(),
  // How much the server logs: debug, info (default), warn or error.
  logLevel: logLevel(),
  // Where messages sent through POST /api/contact go — a contact form on a
  // website served from the same domain (see README). Needs email set up.
  // Unset = no contact form.
  contactTo: address("CONTACT_FORM_TO"),
};

// An email address setting ("a@b.c" or "Name <a@b.c>"); "" when unset.
function address(name: string): string {
  const v = process.env[name]?.trim() ?? "";
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.replace(/^.*<(.+)>$/, "$1"))) {
    throw new Error(`${name} must be an email address, not "${v}".`);
  }
  return v;
}

function metricsToken(): string {
  const token = process.env.METRICS_TOKEN ?? "";
  if (token && token.length < 24) throw new Error("METRICS_TOKEN must be at least 24 characters (try `openssl rand -hex 32`).");
  return token;
}

function metricsRefreshMinutes(): number {
  const minutes = limit("METRICS_REFRESH_MINUTES", 480); // 8 hours
  if (minutes < 1) throw new Error("METRICS_REFRESH_MINUTES must be at least 1.");
  return minutes;
}

function logLevel(): "debug" | "info" | "warn" | "error" {
  const v = process.env.LOG_LEVEL || "info";
  if (v !== "debug" && v !== "info" && v !== "warn" && v !== "error") {
    throw new Error(`LOG_LEVEL must be debug, info, warn or error, not "${v}".`);
  }
  return v;
}

// Who runs this server, for outside services that ask API clients for a
// contact (Open Library allows three times as many requests with one).
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "";

// Sent with every request to Open Library, iTunes and Wiktionary, which ask
// API clients to identify themselves.
export const USER_AGENT =
  `Bookplate/${pkg.version} (+https://github.com/LeoPhh/bookplate` + (CONTACT_EMAIL ? `; ${CONTACT_EMAIL})` : ")");
