import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { USER_AGENT } from "@/lib/config";
import { pace } from "@/lib/outbound";

const UA = { "User-Agent": USER_AGENT };

function imageResponse(buf: ArrayBuffer, contentType: string | null): Response {
  return new Response(buf, {
    headers: {
      "Content-Type": contentType ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

// Fetches a cover image server-side (so the crop canvas isn't tainted by a
// cross-origin source). Tries Open Library's cover id first, then falls back
// to iTunes artwork looked up by title/author — cover hosting differs by
// network reachability, so one source is not enough.
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const p = request.nextUrl.searchParams;
  const id = p.get("id");
  const size = p.get("s") ?? "L";
  const title = p.get("t")?.trim() ?? "";
  const author = p.get("a")?.trim() ?? "";
  if ((id && !/^\d+$/.test(id)) || !/^[SML]$/.test(size)) {
    return new Response("Bad request", { status: 400 });
  }

  if (id) {
    try {
      const res = await fetch(`https://covers.openlibrary.org/b/id/${id}-${size}.jpg`, {
        headers: UA,
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        // Open Library returns a tiny placeholder for missing covers.
        if (buf.byteLength > 500) return imageResponse(buf, res.headers.get("content-type"));
      }
    } catch {
      // Unreachable (some networks block the archive.org backend) — fall through.
    }
  }

  // Fallback: iTunes ebook artwork. Only for full-size requests, and only
  // when we have a title to search by.
  if (size === "L" && title) {
    try {
      await pace("itunes", 5_000);
      const term = encodeURIComponent(`${title} ${author}`.trim());
      const res = await fetch(`https://itunes.apple.com/search?term=${term}&media=ebook&limit=1`, {
        headers: UA,
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const data: { results?: { artworkUrl100?: string }[] } = await res.json();
        const art = data.results?.[0]?.artworkUrl100;
        if (art) {
          const big = art.replace(/100x100bb\.jpg$/, "900x0w.jpg");
          const img = await fetch(big, { headers: UA, signal: AbortSignal.timeout(10_000) });
          if (img.ok) return imageResponse(await img.arrayBuffer(), img.headers.get("content-type"));
        }
      }
    } catch {
      // No fallback available either.
    }
  }

  return new Response("Not found", { status: 404 });
}
