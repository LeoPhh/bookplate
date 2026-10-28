import { eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "../db";

// A reader's profile: the handle others find them by (@ada; "username" on
// screen), a line about themselves, and who may see their reading. Every
// reader has one, made with their account (ensureProfile); they choose who
// sees it.

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
    throw new ProfileError(`A username is ${HANDLE_MIN}–${HANDLE_MAX} letters, digits or underscores.`);
  }
  if (isReserved(handle)) throw new ProfileError("That username is taken.");
  return handle;
}

const isReserved = (handle: string) => RESERVED.has(handle) || handle.startsWith("bookplate");

// "Ada Lovelace" → "ada_lovelace"; a name with nothing usable → "reader".
export function handleFrom(name: string): string {
  const h = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/_+$/, "");
  return h.length >= HANDLE_MIN && !isReserved(h) ? h : "reader";
}

// The first free handle for a name: ada_lovelace, then ada_lovelace2, 3…
async function freeHandle(name: string): Promise<string> {
  const base = handleFrom(name);
  const { rows } = await getDb().execute<{ handle: string }>(
    sql`SELECT handle FROM profile WHERE handle LIKE ${`${base.slice(0, HANDLE_MAX - 6)}%`}`
  );
  const taken = new Set(rows.map((r) => r.handle));
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? "" : String(n);
    const h = base.slice(0, HANDLE_MAX - suffix.length).replace(/_+$/, "") + suffix;
    if (!taken.has(h)) return h;
  }
}

// Checks what Settings sends: any of the fields, each one valid. Returns
// only the fields that were sent.
export function parseProfile(body: unknown): Partial<Profile> {
  const o = (body ?? {}) as Record<string, unknown>;
  const out: Partial<Profile> = {};
  if (o.handle !== undefined) {
    if (typeof o.handle !== "string") throw new ProfileError("Invalid username.");
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

// The reader's profile, made first if they have none yet: a handle from
// their name, seen by their friends. Made at sign-up, for older accounts by
// housekeeping, and again here after remove-profile took one down.
export async function ensureProfile(userId: string): Promise<Profile> {
  const current = await getProfile(userId);
  if (current) return current;
  const [u] = await getDb().select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId));
  if (!u) throw new Error("No such account");
  // Someone else may take the same handle at the same moment: then the next.
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await getDb()
        .insert(profile)
        .values({ userId, handle: await freeHandle(u.name) })
        .onConflictDoNothing({ target: profile.userId })
        .returning();
      return row ? toProfile(row) : (await getProfile(userId))!;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= 5) throw e;
    }
  }
}

// Housekeeping: a profile for every account without one (accounts from
// before profiles, or before SOCIAL=true). Returns how many it made.
export async function ensureAllProfiles(): Promise<number> {
  const missing = await getDb()
    .select({ id: schema.user.id })
    .from(schema.user)
    .leftJoin(profile, eq(profile.userId, schema.user.id))
    .where(isNull(profile.userId));
  for (const { id } of missing) await ensureProfile(id);
  return missing.length;
}

// Changes some of the reader's profile.
export async function saveProfile(userId: string, changes: Partial<Profile>): Promise<Profile> {
  await ensureProfile(userId);
  try {
    const [row] = await getDb()
      .update(profile)
      .set({ ...changes, updatedAt: sql`now()` })
      .where(eq(profile.userId, userId))
      .returning();
    return toProfile(row);
  } catch (e) {
    if (isUniqueViolation(e)) throw new ProfileError("That username is taken.");
    throw e;
  }
}

export async function countProfiles(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(profile);
  return Number(row.n);
}
