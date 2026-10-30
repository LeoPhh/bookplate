import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

// Showcases (public pages of a year's reading) were replaced by profiles.
// All that's left of them is their old addresses, /s/<id>, kept so links
// people were sent can still lead to the reader's profile.

const isShowcaseId = (id: string) => /^[A-Za-z0-9_-]{16}$/.test(id);

// The reader whose showcase had this address, or null.
export async function showcaseOwner(id: string): Promise<string | null> {
  if (!isShowcaseId(id)) return null;
  const [row] = await getDb().select({ userId: schema.showcase.userId }).from(schema.showcase).where(eq(schema.showcase.id, id));
  return row?.userId ?? null;
}
