import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "../db";
import { listBlocked, listFriends } from "./friends";
import { getProfile } from "./profile";

// The reader's social data, for their export (lib/archive.ts, social.json):
// their profile, who their friends are, who they've blocked, and every
// recommendation they sent or received. Other readers appear by name and
// handle only. Never imported back: a friendship takes two.

const { recommendation: rec, user, profile } = schema;

const someone = (p: { name: string | null; handle: string | null }) => ({ name: p.name ?? "", handle: p.handle });

// Every recommendation one way: sent (the other reader is the recipient) or
// received (the sender).
async function recommendations(userId: string, way: "sent" | "received") {
  const other = alias(profile, "other_profile");
  const mine = way === "sent" ? rec.fromUser : rec.toUser;
  const theirs = way === "sent" ? rec.toUser : rec.fromUser;
  const rows = await getDb()
    .select({ r: rec, name: user.name, handle: other.handle })
    .from(rec)
    .leftJoin(user, eq(user.id, theirs))
    .leftJoin(other, eq(other.userId, theirs))
    .where(eq(mine, userId))
    .orderBy(desc(rec.createdAt));
  return rows.map(({ r, name, handle }) => ({
    title: r.title,
    author: r.author,
    note: r.note,
    [way === "sent" ? "to" : "from"]: someone({ name, handle }),
    at: r.createdAt.toISOString(),
    // The sender never learns "not for me", in the export either.
    state: way === "sent" && r.state === "dismissed" ? "seen" : r.state,
  }));
}

export async function socialExport(userId: string) {
  const [p, friends, blocked, sent, received] = await Promise.all([
    getProfile(userId),
    listFriends(userId),
    listBlocked(userId),
    recommendations(userId, "sent"),
    recommendations(userId, "received"),
  ]);
  return {
    profile: p,
    friends: friends.map((f) => ({ ...someone(f), since: f.since })),
    blocked: blocked.map(someone),
    recommendationsSent: sent,
    recommendationsReceived: received,
  };
}
