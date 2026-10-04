import { spawn, type ChildProcess } from "child_process";
import { cpSync, createWriteStream, existsSync, mkdtempSync, rmSync } from "fs";
import { createServer } from "net";
import { tmpdir } from "os";
import path from "path";
import type { TestProject } from "vitest/node";
import { createDatabase, dropDatabase } from "./db";
import { MAILPIT_URL, SMTP_PORT } from "./mailpit";
import { createBucket, removeBucket, S3_TEST } from "./s3";

// Starts the real production build (.next/standalone/server.js) for the API
// tests — three times, each with its own fresh database — and removes it all
// after:
//
//   baseUrl         no email, open registration: most tests
//   emailBaseUrl    email via Mailpit, open registration, so new accounts must
//                   confirm their address: the password-reset and verification tests
//   limitedBaseUrl  tiny per-account limits (LIMIT_*): the limits tests
//
// Needs `npm run build` and `npm run db:up` (Postgres, Mailpit, RustFS), or
// TEST_DATABASE_ADMIN_URL / MAILPIT_URL / TEST_S3_* pointing elsewhere.
//
// Images go to disk by default; TEST_STORAGE=s3 runs the whole suite with
// both servers storing them in a throwaway S3 bucket instead.

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
    dbUrl: string;
    emailBaseUrl: string;
    limitedBaseUrl: string;
    plainLog: string; // files holding each server's output, for the logging tests
    emailLog: string;
    s3Bucket: string; // "" unless TEST_STORAGE=s3
  }
}

const ROOT = path.resolve(__dirname, "../..");

// The plain server serves /api/metrics with this token.
export const METRICS_TOKEN = "test-metrics-token-0123456789abcdef";
const SERVER = path.join(ROOT, ".next/standalone/server.js");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

interface Server {
  url: string;
  dbUrl: string;
  logFile: string;
  stop: () => Promise<void>;
}

async function startServer(name: string, extraEnv: Record<string, string>): Promise<Server> {
  const dbName = `bookplate_test_${name}_${process.pid}`;
  const dbUrl = await createDatabase(dbName);
  const uploads = mkdtempSync(path.join(tmpdir(), "bookplate-test-uploads-"));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  let log = "";

  // Run the server exactly as in production: drop the test runner's own
  // variables (TEST, VITEST…), which libraries use to switch off safeguards.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !/^(TEST|VITEST.*|NODE_ENV|MODE|DEV|PROD|SSR|BASE_URL|SMTP_.*|STORAGE|S3_.*|METRICS_TOKEN|LIMIT_.*|LOG_LEVEL|LEGAL_DIR|SMTP_REPLY_TO|EMAIL_LIMIT_PER_DAY|CONTACT_FORM_TO)$/.test(k)
    )
  );
  const child: ChildProcess = spawn(process.execPath, [SERVER], {
    env: {
      ...env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: dbUrl,
      AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
      PUBLIC_URL: url,
      UPLOADS_DIR: uploads,
      // Several test readers per run.
      REGISTRATION: "open",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logFile = path.join(tmpdir(), `bookplate-test-${name}-${process.pid}.log`);
  const out = createWriteStream(logFile);
  child.stdout?.on("data", (d) => ((log += d), out.write(d)));
  child.stderr?.on("data", (d) => ((log += d), out.write(d)));

  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`The ${name} test server exited early:\n${log}`);
    try {
      if ((await fetch(`${url}/api/health`)).ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error(`The ${name} test server didn't become healthy:\n${log}`);
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    url,
    dbUrl,
    logFile,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((r) => child.once("exit", r));
      out.end();
      rmSync(uploads, { recursive: true, force: true });
      rmSync(logFile, { force: true });
      await dropDatabase(dbName);
    },
  };
}

export default async function setup(project: TestProject) {
  if (!existsSync(SERVER)) {
    throw new Error("The API tests run against the production build — run `npm run build` first.");
  }
  try {
    await fetch(`${MAILPIT_URL}/api/v1/messages`);
  } catch {
    throw new Error(`Mailpit isn't reachable at ${MAILPIT_URL} — run \`npm run db:up\` (it starts Postgres, Mailpit and RustFS).`);
  }
  // The server applies migrations from ./drizzle next to server.js on start.
  cpSync(path.join(ROOT, "drizzle"), path.join(ROOT, ".next/standalone/drizzle"), { recursive: true });

  // With TEST_STORAGE=s3, both servers share one throwaway bucket, each in
  // its own folder (which also exercises S3_PREFIX).
  const bucket = process.env.TEST_STORAGE === "s3" ? `bookplate-test-${process.pid}` : null;
  if (bucket) await createBucket(bucket);
  const storage = (folder: string): Record<string, string> =>
    bucket
      ? {
          STORAGE: "s3",
          S3_ENDPOINT: S3_TEST.endpoint,
          S3_REGION: S3_TEST.region,
          S3_BUCKET: bucket,
          S3_ACCESS_KEY_ID: S3_TEST.accessKeyId,
          S3_SECRET_ACCESS_KEY: S3_TEST.secretAccessKey,
          S3_FORCE_PATH_STYLE: "true",
          S3_PREFIX: folder,
        }
      : {};

  const [plain, email, limited] = await Promise.all([
    startServer("plain", { ...storage("plain"), METRICS_TOKEN, LEGAL_DIR: path.join(ROOT, "test/fixtures/legal") }),
    startServer("email", {
      ...storage("email"),
      SMTP_HOST: new URL(MAILPIT_URL).hostname,
      SMTP_PORT: String(SMTP_PORT),
      SMTP_FROM: "Bookplate <bookplate@test.local>",
      SMTP_REPLY_TO: "Bookplate Support <support@test.local>",
      CONTACT_FORM_TO: "Bookplate Inbox <inbox@test.local>",
    }),
    startServer("limited", {
      ...storage("limited"),
      LIMIT_BOOKS: "3",
      LIMIT_WORDS: "2",
      LIMIT_STORAGE_MB: "1",
      LIMIT_UPLOAD_MB: "1",
      LIMIT_IMPORT_MB: "1",
    }),
  ]);

  project.provide("baseUrl", plain.url);
  project.provide("dbUrl", plain.dbUrl);
  project.provide("emailBaseUrl", email.url);
  project.provide("limitedBaseUrl", limited.url);
  project.provide("plainLog", plain.logFile);
  project.provide("emailLog", email.logFile);
  project.provide("s3Bucket", bucket ?? "");

  return async () => {
    await Promise.all([plain.stop(), email.stop(), limited.stop()]);
    if (bucket) await removeBucket(bucket);
  };
}
