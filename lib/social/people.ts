import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { listBooks, listProgress } from "../library";
import { todayIso } from "../progress";
import { audienceFor, canSeeReading, type Audience } from "./access";
import { findHandle, type Profile } from "./profile";
import { buildProfileStats, type ProfileStats } from "./profileStats";
import { personBook, profileAvatar, visibleBooks } from "./projection";
import { compareTaste, type Taste } from "./taste";

// A reader's profile page as one viewer may see it, or null when there's no
// such handle or a block either way: the caller answers 404 either way.
// Everyone else sees the profile; `seesReading` says whether they also see
// the books and numbers on it.

export interface Person {
  userId: string;
  name: string;
  image: string | null; // at an address this viewer may load
  profile: Profile;
  audience: Audience;
  seesReading: boolean;
}

export async function findPerson(viewerId: string | null, handle: string): Promise<Person | null> {
  const found = await findHandle(handle);
  if (!found) return null;
  const audience = await audienceFor(viewerId, found.userId);
  if (audience === "blocked") return null;
  const [u] = await getDb()
    .select({ name: schema.user.name, image: schema.user.image })
    .from(schema.user)
    .where(eq(schema.user.id, found.userId));
  if (!u) return null;
  return {
    userId: found.userId,
    name: u.name,
    image: audience === "self" ? (u.image ?? null) : profileAvatar(found.profile.handle, u.image),
    profile: found.profile,
    audience,
    seesReading: canSeeReading(audience, found.profile.visibility),
  };
}

// The books this viewer may see, as they may see them. Owners see what their
// friends see, with their own cover addresses, which only they can load.
export async function personBooks(p: Person) {
  if (!p.seesReading) return [];
  const self = p.audience === "self";
  const books = visibleBooks(await listBooks(p.userId), self ? "friend" : p.audience, p.profile);
  return books.map((b) => personBook(b, p.profile, self ? null : p.profile.handle));
}

// The profile page's numbers, and for another signed-in reader how their
// reading compares (taste is null on the owner's own page and for visitors).
export async function loadPersonView(
  p: Person,
  { viewerId }: { viewerId: string | null }
): Promise<{ stats: ProfileStats; taste: Taste | null }> {
  const today = todayIso();
  const showProgress = p.seesReading && (p.audience === "self" || p.profile.shareReading);
  const compare = viewerId !== null && p.audience !== "self" && p.seesReading;
  const [books, progress, mine] = await Promise.all([
    personBooks(p),
    showProgress ? listProgress(p.userId) : [],
    compare ? listBooks(viewerId) : null,
  ]);
  return {
    stats: buildProfileStats(books, progress, { today }),
    taste: mine ? compareTaste(mine, books) : null,
  };
}
