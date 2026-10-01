import { createHmac } from "crypto";
import { createChallenge, randomInt, verifySolution, type Challenge, type Payload } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { claimOnce } from "./authThrottle";
import { config } from "./config";

// An invisible check on sign-ups (ALTCHA proof of work): the sign-up page
// fetches a puzzle and the browser solves it while the person types, which
// takes a second or two of computing. Trivial once, but it makes creating
// accounts in bulk slow and costly. There's no picture puzzle and nothing is
// sent to anyone else. Used with open registration (config.signupBotCheck).

export const CHALLENGE_HEADER = "x-signup-challenge";

const EXPIRES_MS = 10 * 60 * 1000;
// About 3,000–8,000 rounds of 500 PBKDF2 iterations to find the answer.
const COST = 500;
const COUNTER = [3_000, 8_000] as const;

// Signed with a key derived from AUTH_SECRET, so the server can tell its own
// puzzles from made-up ones without storing them.
const signingKey = () => createHmac("sha256", config.authSecret).update("bookplate signup challenge").digest("hex");

export function newChallenge(): Promise<Challenge> {
  return createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: COST,
    counter: randomInt(COUNTER[0], COUNTER[1]),
    deriveKey,
    hmacSignatureSecret: signingKey(),
    expiresAt: new Date(Date.now() + EXPIRES_MS),
  });
}

// Checks the solved puzzle a sign-up request carries (base64 JSON in the
// x-signup-challenge header). Each puzzle works once. Returns null when it
// passes, or what went wrong.
export async function checkChallenge(header: string | null | undefined): Promise<string | null> {
  if (!header) return "missing";
  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return "unreadable";
  }
  if (!payload?.challenge?.signature || !payload.solution) return "unreadable";
  const result = await verifySolution({
    challenge: payload.challenge,
    solution: payload.solution,
    deriveKey,
    hmacSignatureSecret: signingKey(),
  }).catch(() => null);
  if (!result?.verified) return result?.expired ? "expired" : "wrong";
  if (!(await claimOnce(`challenge:${payload.challenge.signature}`, EXPIRES_MS))) return "reused";
  return null;
}
