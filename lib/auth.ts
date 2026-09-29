import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { count } from "drizzle-orm";
import { headers } from "next/headers";
import { config } from "./config";
import { getDb, schema } from "./db";

// Created on first use, not at import, so `next build` doesn't need a
// database or secret.
function createAuth() {
  return betterAuth({
    secret: config.authSecret,
    baseURL: config.publicUrl,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    // Besides PUBLIC_URL, accept requests whose Origin matches the host they
    // were sent to, so reaching the server by IP or a second hostname still
    // works. A cross-site request always carries the other site's Origin,
    // so this keeps the CSRF protection intact.
    trustedOrigins: (request) => {
      const origins = [new URL(config.publicUrl).origin];
      const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
      if (request && host) {
        const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
        origins.push(`${proto}://${host}`);
      }
      return origins;
    },
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    telemetry: { enabled: false },
    databaseHooks: {
      user: {
        create: {
          // With registration closed, only the very first account (the
          // owner, created on the /setup screen) may sign up.
          before: async () => {
            if (config.registration === "open") return;
            if ((await countUsers()) > 0) {
              throw new APIError("FORBIDDEN", { message: "Registration is closed on this server." });
            }
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export async function countUsers(): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(schema.user);
  return row.n;
}

export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

// Route handlers call this first: it returns the signed-in user's id, or a
// 401 response to hand straight back.
export async function requireUser(): Promise<{ userId: string } | { response: Response }> {
  const session = await getSession();
  if (!session) return { response: Response.json({ error: "Not signed in" }, { status: 401 }) };
  return { userId: session.user.id };
}
