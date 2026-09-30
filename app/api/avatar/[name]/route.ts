import { requireUser } from "@/lib/auth";
import { getStorage, isSafeFileName, keys } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { name } = await params;
  if (!isSafeFileName(name)) return new Response("Not found", { status: 404 });
  const data = await getStorage().get(keys.avatar(auth.userId, name));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "image/jpeg",
      // Every photo has a unique name and is never rewritten.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
