import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { count } from "drizzle-orm";
import { headers } from "next/headers";
import { config } from "./config";
import { getDb, schema } from "./db";
import { clearThrottle, recordFailure, throttleWait } from "./authThrottle";
import { CHALLENGE_HEADER, checkChallenge } from "./botCheck";
import { CLIENT_IP_HEADER, clientIp } from "./clientIp";
import { resetPasswordEmail, sendEmail, verifyEmail, type Email } from "./email";

const signInKey = (body: unknown) =>
  `sign-in:${String((body as { email?: unknown } | undefined)?.email ?? "").trim().toLowerCase()}`;

// At most 3 emails of each kind per address per 15 minutes, so nobody can
// flood someone's inbox. Over the limit, nothing is sent and nothing is said:
// the request still looks successful, which also gives nothing away about
// which addresses have accounts.
const SENDS_PER_WINDOW = 3;

// At most 5 new accounts from one address an hour (see lib/clientIp.ts for
// how far that address can be trusted).
const SIGNUPS_PER_IP = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const signUpKey = (headers: Headers | undefined) => `sign-up:${clientIp(headers)}`;

async function sendLimited(kind: string, email: Email): Promise<void> {
  const key = `${kind}:${email.to.toLowerCase()}`;
  if ((await throttleWait(key, SENDS_PER_WINDOW)) > 0) return;
  await recordFailure(key);
  try {
    await sendEmail(email);
  } catch (e) {
    // Logged for the server's owner, not shown: an error here would only
    // happen for real accounts, revealing which addresses exist. Settings →
    // "Send test email" is where mail problems show up.
    console.error(`[email] could not send the ${kind} email:`, e instanceof Error ? e.message : e);
  }
}

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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Only with open registration and email set up (see lib/config.ts).
      requireEmailVerification: config.requireEmailVerification,
      // Password reset by email, when email is set up. Without it, the
      // server's owner resets passwords with `reset-password` on the server.
      sendResetPassword: config.email.enabled
        ? ({ user, url }) => sendLimited("reset", resetPasswordEmail(user.email, url))
        : undefined,
      resetPasswordTokenExpiresIn: 60 * 60, // one hour; each link works once
      revokeSessionsOnPasswordReset: true, // sign every device out
      onPasswordReset: async ({ user }) => {
        // A fresh password lifts any wrong-password block on the account.
        await clearThrottle(`sign-in:${user.email.toLowerCase()}`);
      },
    },
    emailVerification: config.email.enabled
      ? {
          sendVerificationEmail: ({ user, url }) => sendLimited("verify", verifyEmail(user.email, url)),
          sendOnSignUp: config.requireEmailVerification,
          // Signing in before confirming sends a fresh link (still limited).
          sendOnSignIn: config.requireEmailVerification,
          autoSignInAfterVerification: true,
          expiresIn: 60 * 60,
        }
      : undefined,
    telemetry: { enabled: false },
    // Better Auth quietly skips its cross-site (origin/CSRF) checks when it
    // thinks it's under test — e.g. a stray TEST=true in the environment.
    // Pin them on so no environment variable can switch them off.
    // Its rate limits read the visitor's address from the header proxy.ts
    // sets — never straight from X-Forwarded-For, which visitors can fake.
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    // Too many wrong passwords for one account blocks it for a while,
    // whichever IP address the attempts claim (see lib/authThrottle.ts).
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          if ((await throttleWait(signUpKey(ctx.headers), SIGNUPS_PER_IP, SIGNUP_WINDOW_MS)) > 0) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Too many new accounts from your network — try again in an hour.",
            });
          }
          if (config.signupBotCheck && (await checkChallenge(ctx.headers?.get(CHALLENGE_HEADER)))) {
            throw new APIError("FORBIDDEN", {
              message: "The sign-up check didn’t go through — reload the page and try again.",
            });
          }
          return;
        }
        if (ctx.path !== "/sign-in/email") return;
        const wait = await throttleWait(signInKey(ctx.body));
        if (wait > 0) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: `Too many wrong passwords — try again in ${wait} minute${wait === 1 ? "" : "s"}.`,
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const result = ctx.context.returned;
        if (ctx.path === "/sign-up/email") {
          if (!isAPIError(result)) await recordFailure(signUpKey(ctx.headers), SIGNUP_WINDOW_MS);
          return;
        }
        if (ctx.path !== "/sign-in/email") return;
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
