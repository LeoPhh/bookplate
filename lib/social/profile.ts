import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";

// A reader's profile: the handle others find them by (@ada), a line about
// themselves, and who may see their reading. Readers make one when they want
// one; without it nobody else sees anything of theirs.

export const VISIBILITIES = ["private", "friends", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export interface Profile {
  handle: string;
  bio: string | null;
  visibility: Visibility; // private: only them; friends; public: anyone with the link
  shareReading: boolean; // what they're reading now, with how far along
  shareRatings: boolean;
}

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;
export const BIO_MAX = 160;
const HANDLE = new RegExp(`^[a-z0-9_]{${HANDLE_MIN},${HANDLE_MAX}}$`);

// Handles that would pass for the service speaking, or clash with a page.
const RESERVED = new Set([
  "abuse", "admin", "administrator", "anonymous", "api", "bookplate", "everyone", "friends", "help", "invite",
  "login", "me", "mod", "moderator", "noreply", "null", "official", "postmaster", "privacy", "profile", "root",
  "security", "settings", "signup", "staff", "support", "system", "team", "terms", "undefined", "webmaster",
]);

const { profile } = schema;

export class ProfileError extends Error {}

// "  @Ada_L " → "ada_l": how a handle is typed doesn't matter.
export const normaliseHandle = (raw: string) => raw.trim().replace(/^@/, "").toLowerCase();

export function checkHandle(raw: string): string {
  const handle = normaliseHandle(raw);
  if (!HANDLE.test(handle)) {
    throw new ProfileError(`A handle is ${HANDLE_MIN}–${HANDLE_MAX} letters, digits or underscores.`);
  }
  if (RESERVED.has(handle) || handle.startsWith("bookplate")) throw new ProfileError("That handle is taken.");
  return handle;
}

// Checks what Settings sends: any of the fields, each one valid. Returns
// only the fields that were sent.
export function parseProfile(body: unknown): Partial<Profile> {
  const o = (body ?? {}) as Record<string, unknown>;
  const out: Partial<Profile> = {};
  if (o.handle !== undefined) {
    if (typeof o.handle !== "string") throw new ProfileError("Invalid handle.");
    out.handle = checkHandle(o.handle);
  }
  if (o.bio !== undefined) {
    if (o.bio !== null && typeof o.bio !== "string") throw new ProfileError("Invalid bio.");
    // Plain text on one line: line breaks become spaces, then any other
    // control characters (direction overrides…) go.
    const bio = (o.bio ?? "").replace(/\s+/g, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
    if ([...bio].length > BIO_MAX) throw new ProfileError(`Keep the bio to ${BIO_MAX} characters.`);
    out.bio = bio || null;
  }
  if (o.visibility !== undefined) {
    if (!VISIBILITIES.includes(o.visibility as Visibility)) throw new ProfileError("Invalid visibility.");
    out.visibility = o.visibility as Visibility;
  }
  for (const k of ["shareReading", "shareRatings"] as const) {
    if (o[k] === undefined) continue;
    if (typeof o[k] !== "boolean") throw new ProfileError(`${k} must be true or false.`);
    out[k] = o[k];
  }
  return out;
}

const toProfile = (r: typeof profile.$inferSelect): Profile => ({
  handle: r.handle,
  bio: r.bio,
  visibility: r.visibility as Visibility,
  shareReading: r.shareReading,
  shareRatings: r.shareRatings,
});

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await getDb().select().from(profile).where(eq(profile.userId, userId));
  return row ? toProfile(row) : null;
}

// The reader behind a handle, or null when nobody has it.
export async function findHandle(raw: string): Promise<{ userId: string; profile: Profile } | null> {
  const handle = normaliseHandle(raw);
  if (!HANDLE.test(handle)) return null;
  const [row] = await getDb().select().from(profile).where(eq(profile.handle, handle));
  return row ? { userId: row.userId, profile: toProfile(row) } : null;
}

const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
};

// Makes the reader's profile (a handle is needed the first time) or changes
// some of it.
export async function saveProfile(userId: string, changes: Partial<Profile>): Promise<Profile> {
  const current = await getProfile(userId);
  if (!current && !changes.handle) throw new ProfileError("Choose a handle.");
  const next = { ...(current ?? { bio: null, visibility: "friends", shareReading: true, shareRatings: true }), ...changes } as Profile;
  try {
    const [row] = await getDb()
      .insert(profile)
      .values({ userId, ...next })
      .onConflictDoUpdate({ target: profile.userId, set: { ...next, updatedAt: sql`now()` } })
      .returning();
    return toProfile(row);
  } catch (e) {
    if (isUniqueViolation(e)) throw new ProfileError("That handle is taken.");
    throw e;
  }
}

// Removes the profile: nobody else can see anything of the reader's any
// more, and the handle is free again. Friendships stay.
export async function deleteProfile(userId: string): Promise<void> {
  await getDb().delete(profile).where(eq(profile.userId, userId));
}

export async function countProfiles(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(profile);
  return Number(row.n);
}
