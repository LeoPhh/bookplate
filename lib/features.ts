import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { isFeature, type FeatureId } from "./featureList";

// The reader's optional features (lib/featureList.ts), kept on the account.

export async function getFeatures(userId: string): Promise<FeatureId[]> {
  const [row] = await getDb()
    .select({ features: schema.user.features })
    .from(schema.user)
    .where(eq(schema.user.id, userId));
  return (row?.features ?? []).filter(isFeature);
}

export async function setFeature(userId: string, id: FeatureId, on: boolean): Promise<FeatureId[]> {
  const col = schema.user.features;
  const [row] = await getDb()
    .update(schema.user)
    .set({
      features: on
        ? sql`CASE WHEN ${id} = ANY(${col}) THEN ${col} ELSE array_append(${col}, ${id}) END`
        : sql`array_remove(${col}, ${id})`,
    })
    .where(eq(schema.user.id, userId))
    .returning({ features: col });
  return (row?.features ?? []).filter(isFeature);
}
