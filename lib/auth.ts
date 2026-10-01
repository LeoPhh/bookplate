import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { count } from "drizzle-orm";
import { headers } from "next/headers";
import { config } from "./config";
import { getDb, schema } from "./db";
import { clearThrottle, recordFailure, throttleWait } from "./authThrottle";

const signInKey = (body: unknown) =>
  `sign-in:${String((body as { email?: unknown } | undefined)?.email ?? "").trim().toLowerCase()}`;

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
    // Better Auth quietly skips its cross-site (origin/CSRF) checks when it
    // thinks it's under test — e.g. a stray TEST=true in the environment.
    // Pin them on so no environment variable can switch them off.
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    // Too many wrong passwords for one account blocks it for a while,
    // whichever IP address the attempts claim (see lib/authThrottle.ts).
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const wait = await throttleWait(signInKey(ctx.body));
        if (wait > 0) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: `Too many wrong passwords — try again in ${wait} minute${wait === 1 ? "" : "s"}.`,
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const result = ctx.context.returned;
        if (isAPIError(result)) {
          if (result.statusCode === 401) await recordFailure(signInKey(ctx.body));
        } else {
          await clearThrottle(signInKey(ctx.body));
        }
      }),
    },
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
