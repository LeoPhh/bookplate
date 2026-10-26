import { getSession } from "@/lib/auth";
import { findPerson, personBooks } from "@/lib/social/people";
import { socialOff } from "@/lib/social/gate";
import { getStorage, isSafeFileName, keys } from "@/lib/storage";

// A cover on a profile page: only the covers of books this viewer may see
// there. Cover addresses carry no reader, so without this a friend's
// /api/covers/<file> would look in the viewer's own covers.
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string; name: string }> }) {
  if (socialOff()) return new Response("Not found", { status: 404 });
  const { handle, name } = await params;
  if (!isSafeFileName(name)) return new Response("Not found", { status: 404 });
  const session = await getSession().catch(() => null);
  const person = await findPerson(session?.user.id ?? null, handle);
  if (!person) return new Response("Not found", { status: 404 });
  const books = await personBooks(person);
  const shown = books.some((b) => b.coverImage?.split("?")[0].endsWith(`/covers/${name}`));
  if (!shown) return new Response("Not found", { status: 404 });
  const data = await getStorage().get(keys.cover(person.userId, name));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "image/jpeg",
      // Who may see it depends on who's asking, and can change (unfriending,
      // a profile made private): never shared caches, and not for long.
      "Cache-Control": "private, max-age=300",
    },
  });
}
