import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { FriendError } from "./errors";

// A reader's goal for the year: how many books they mean to finish. It shows
// on their profile to whoever may see their reading.

const { readingGoal } = schema;

export const GOAL_MAX = 500;

export function checkGoal(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > GOAL_MAX) {
    throw new FriendError(`A goal is a whole number of books, from 1 to ${GOAL_MAX}.`);
  }
  return raw;
}

export async function getGoal(userId: string, year: number): Promise<number | null> {
  const [row] = await getDb()
    .select({ books: readingGoal.books })
    .from(readingGoal)
    .where(and(eq(readingGoal.userId, userId), eq(readingGoal.year, year)));
  return row?.books ?? null;
}

export async function setGoal(userId: string, year: number, books: number): Promise<void> {
  await getDb()
    .insert(readingGoal)
    .values({ userId, year, books })
    .onConflictDoUpdate({ target: [readingGoal.userId, readingGoal.year], set: { books, updatedAt: sql`now()` } });
}

export async function clearGoal(userId: string, year: number): Promise<void> {
  await getDb().delete(readingGoal).where(and(eq(readingGoal.userId, userId), eq(readingGoal.year, year)));
}

// Every goal the reader has set, for their export.
export async function listGoals(userId: string): Promise<{ year: number; books: number }[]> {
  return getDb().select({ year: readingGoal.year, books: readingGoal.books }).from(readingGoal).where(eq(readingGoal.userId, userId)).orderBy(readingGoal.year);
}
