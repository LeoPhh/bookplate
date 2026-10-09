import { coverFileOf, loadShowcase } from "@/lib/showcase";
import { getStorage, isSafeFileName, keys } from "@/lib/storage";

// A cover on a showcase page, for anyone with its address: only the covers of
// the books that showcase shows, and only while it's on.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;
  if (!isSafeFileName(name)) return new Response("Not found", { status: 404 });
  const found = await loadShowcase(id);
  if (!found || !coverFileOf(found.view, name)) return new Response("Not found", { status: 404 });
  const data = await getStorage().get(keys.cover(found.userId, name));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "image/jpeg",
      // Short, so a showcase that's turned off stops showing covers soon.
      "Cache-Control": "public, max-age=300",
    },
  });
}
