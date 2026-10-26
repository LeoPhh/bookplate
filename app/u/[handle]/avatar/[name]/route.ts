import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { findPerson } from "@/lib/social/people";
import { socialOff } from "@/lib/social/gate";
import { getStorage, isSafeFileName, keys } from "@/lib/storage";

// A reader's profile photo, for whoever may see their profile: only the
// photo they have now.
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string; name: string }> }) {
  if (socialOff()) return new Response("Not found", { status: 404 });
  const { handle, name } = await params;
  if (!isSafeFileName(name)) return new Response("Not found", { status: 404 });
  const session = await getSession().catch(() => null);
  const person = await findPerson(session?.user.id ?? null, handle);
  if (!person) return new Response("Not found", { status: 404 });
  const [u] = await getDb().select({ image: schema.user.image }).from(schema.user).where(eq(schema.user.id, person.userId));
  if (u?.image !== `/api/avatar/${name}`) return new Response("Not found", { status: 404 });
  const data = await getStorage().get(keys.avatar(person.userId, name));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" },
  });
}
