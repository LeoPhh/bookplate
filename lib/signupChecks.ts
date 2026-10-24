// Checks for the account forms (setup and sign-up), run when the reader
// submits. The server has the last word on length: lib/auth.ts passes
// MIN_PASSWORD_LENGTH to Better Auth, so the two stay in step.

export const MIN_PASSWORD_LENGTH = 6;

// Something@somewhere.something. Deliberately loose: the confirmation email
// is the real test, this only catches typos like a missing @.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// Long enough, with both lowercase and uppercase letters (any alphabet).
export function meetsPasswordRules(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password);
}

export const MESSAGES = {
  email: "That address won’t reach us. Check it’s written like name@example.com.",
  emailTaken: "This email already has a library here.",
  password: `Password should be at least ${MIN_PASSWORD_LENGTH} characters and contain lowercase and uppercase letters.`,
  mismatch: "These passwords don’t match.",
};
