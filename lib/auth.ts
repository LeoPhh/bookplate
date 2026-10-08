import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { and, count, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { config } from "./config";
import { getDb, schema } from "./db";
import { clearThrottle, recordFailure, throttleWait } from "./authThrottle";
import { CHALLENGE_HEADER, checkChallenge } from "./botCheck";
import { CLIENT_IP_HEADER, clientIp } from "./clientIp";
import { resetPasswordEmail, sendEmail, verifyEmail, type Email } from "./email";
import { account, log } from "./log";

const emailOf = (body: unknown) => String((body as { email?: unknown } | undefined)?.email ?? "").trim().toLowerCase();
const signInKey = (body: unknown) => `sign-in:${emailOf(body)}`;
// The account a sign-in or sign-up result belongs to, if it succeeded.
const userIdOf = (result: unknown) => (result as { user?: { id?: string } } | null)?.user?.id;

// At most 3 emails of each kind per address per 15 minutes, so nobody can
// flood someone's inbox. Over the limit, nothing is sent and nothing is said:
// the request still looks successful, which also gives nothing away about
// which addresses have accounts.
const SENDS_PER_WINDOW = 3;

// At most 5 new accounts from one address an hour (see lib/clientIp.ts for
// how far that address can be trusted).
const SIGNUPS_PER_IP = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

// A sign-in lasts 30 days from the last visit: using Bookplate extends it
// (at most once a day), so only a device left unused for a month signs out.
export const SESSION_DAYS = 30;
const DAY_S = 24 * 60 * 60;
const signUpKey = (headers: Headers | undefined) => `sign-up:${clientIp(headers)}`;

async function sendLimited(kind: string, email: Email): Promise<void> {
  const key = `${kind}:${email.to.toLowerCase()}`;
  if ((await throttleWait(key, SENDS_PER_WINDOW)) > 0) {
    void log.info("email.rate_limited", { kind, account: account(email.to) });
    return;
  }
  await recordFailure(key);
  try {
    await sendEmail(email);
    void log.info("email.sent", { kind, account: account(email.to) });
  } catch (e) {
    // Logged for the server's owner, not shown: an error here would only
    // happen for real accounts, revealing which addresses exist. Settings →
    // "Send test email" is where mail problems show up.
    void log.error("email.send_failed", { kind, account: account(email.to), error: e });
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
        void log.info("auth.password_reset", { user: user.id });
        // A fresh password lifts any wrong-password block on the account.
        await clearThrottle(`sign-in:${user.email.toLowerCase()}`);
        // The reset link only reached someone with access to this inbox, so
        // the address is confirmed — otherwise an account made before email
        // confirmation was switched on (e.g. the owner's, at /setup) is locked
        // out right after resetting. (The reset-password command on the
        // server proves nothing about the inbox and doesn't do this.)
        await getDb()
          .update(schema.user)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(and(eq(schema.user.id, user.id), eq(schema.user.emailVerified, false)));
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
    session: { expiresIn: SESSION_DAYS * DAY_S, updateAge: DAY_S },
    telemetry: { enabled: false },
    // Better Auth's own warnings and errors, as JSON lines like ours. Only
    // messages and errors: its extra arguments can hold user records.
    logger: {
      level: "warn",
      log: (level, message, ...args) => {
        const error = args.find((a) => a instanceof Error);
        void log[level]("auth.library", { message, error });
      },
    },
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
            void log.warn("auth.sign_up_limited", { ip: clientIp(ctx.headers) });
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Too many new accounts from your network — try again in an hour.",
            });
          }
          const failed = config.signupBotCheck ? await checkChallenge(ctx.headers?.get(CHALLENGE_HEADER)) : null;
          if (failed) {
            void log.warn("auth.bot_check_failed", { reason: failed, ip: clientIp(ctx.headers) });
            throw new APIError("FORBIDDEN", {
              message: "The sign-up check didn’t go through — reload the page and try again.",
            });
          }
          return;
        }
        if (ctx.path !== "/sign-in/email") return;
        const wait = await throttleWait(signInKey(ctx.body));
        if (wait > 0) {
          void log.warn("auth.sign_in_blocked", { account: account(emailOf(ctx.body)), ip: clientIp(ctx.headers) });
          throw new APIError("TOO_MANY_REQUESTS", {
            message: `Too many wrong passwords — try again in ${wait} minute${wait === 1 ? "" : "s"}.`,
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const result = ctx.context.returned;
        if (ctx.path === "/sign-up/email") {
          if (!isAPIError(result)) {
            await recordFailure(signUpKey(ctx.headers), SIGNUP_WINDOW_MS);
            const newsletter = config.newsletter && wantsNewsletter(ctx.body);
            void log.info("auth.sign_up", { user: userIdOf(result), ip: clientIp(ctx.headers), newsletter });
            // A sign-up with an address that already has an account answers
            // with a made-up user (so it gives nothing away), whose id matches
            // no row: the real account's choice stays as it was.
            const id = userIdOf(result);
            if (newsletter && id) await setNewsletter(id, true);
          }
          return;
        }
        if (ctx.path !== "/sign-in/email") return;
        if (isAPIError(result)) {
          if (result.statusCode === 403 && result.body?.code === "EMAIL_NOT_VERIFIED") {
            void log.info("auth.sign_in_unconfirmed", { account: account(emailOf(ctx.body)) });
          }
          if (result.statusCode === 401) {
            await recordFailure(signInKey(ctx.body));
            void log.info("auth.sign_in_failed", { account: account(emailOf(ctx.body)), ip: clientIp(ctx.headers) });
          }
        } else {
          await clearThrottle(signInKey(ctx.body));
          void log.info("auth.sign_in", { user: userIdOf(result) });
        }
      }),
    },
    databaseHooks: {
      // Sessions keep no IP address or browser string: nothing reads them,
      // and the privacy policy keeps those for 30 days, while a session can
      // last far longer.
      // Signing in, and a session being extended (at most daily, on use),
      // count as the account being seen.
      session: {
        create: {
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
          after: async (session) => markSeen(session.userId),
        },
        update: {
          after: async (session) => {
            if (session?.userId) await markSeen(session.userId);
          },
        },
      },
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

// The sign-up form's newsletter tick box (sent along with name and email).
const wantsNewsletter = (body: unknown) => (body as { newsletter?: unknown } | undefined)?.newsletter === true;

// Subscribes or unsubscribes an account. Subscribing again keeps the time
// the reader first agreed.
export async function setNewsletter(userId: string, on: boolean): Promise<void> {
  await getDb()
    .update(schema.user)
    .set({ newsletterConsentAt: on ? sql`coalesce(${schema.user.newsletterConsentAt}, now())` : null })
    .where(eq(schema.user.id, userId));
}

async function markSeen(userId: string): Promise<void> {
  await getDb().update(schema.user).set({ lastSeenAt: sql`now()` }).where(eq(schema.user.id, userId));
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
