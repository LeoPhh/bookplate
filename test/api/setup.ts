import { spawn, type ChildProcess } from "child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "fs";
import { createServer } from "net";
import { tmpdir } from "os";
import path from "path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

// Starts the real production build (.next/standalone/server.js) against a
// fresh database for the API tests, and removes both afterwards.
//
// Needs `npm run build` and a Postgres you can create databases on — the dev
// one from `npm run db:up` by default, or TEST_DATABASE_ADMIN_URL.

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

const ROOT = path.resolve(__dirname, "../..");
const SERVER = path.join(ROOT, ".next/standalone/server.js");
const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://bookplate:bookplate@localhost:5433/bookplate";

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

async function admin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export default async function setup(project: TestProject) {
  if (!existsSync(SERVER)) {
    throw new Error("The API tests run against the production build — run `npm run build` first.");
  }
  // The server applies migrations from ./drizzle next to server.js on start.
  cpSync(path.join(ROOT, "drizzle"), path.join(ROOT, ".next/standalone/drizzle"), { recursive: true });

  const dbName = `bookplate_test_${process.pid}`;
  await admin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await c.query(`CREATE DATABASE ${dbName}`);
  });
  const dbUrl = new URL(ADMIN_URL);
  dbUrl.pathname = `/${dbName}`;

  const uploads = mkdtempSync(path.join(tmpdir(), "bookplate-test-uploads-"));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let log = "";

  // Run the server exactly as in production: drop the test runner's own
  // variables (TEST, VITEST…), which libraries use to switch off safeguards.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^(TEST|VITEST.*|NODE_ENV|MODE|DEV|PROD|SSR|BASE_URL)$/.test(k))
  );
  const child: ChildProcess = spawn(process.execPath, [SERVER], {
    env: {
      ...env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: dbUrl.toString(),
      AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
      PUBLIC_URL: baseUrl,
      UPLOADS_DIR: uploads,
      // Several test users per run; the closed default is covered separately.
      REGISTRATION: "open",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => (log += d));
  child.stderr?.on("data", (d) => (log += d));

  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`The test server exited early:\n${log}`);
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error(`The test server didn't become healthy:\n${log}`);
    await new Promise((r) => setTimeout(r, 250));
  }

  project.provide("baseUrl", baseUrl);

  return async () => {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
    rmSync(uploads, { recursive: true, force: true });
    await admin((c) => c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`));
  };
}
