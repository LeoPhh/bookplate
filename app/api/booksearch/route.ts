import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCache } from "@/lib/cache";
import { USER_AGENT } from "@/lib/config";
import { OpenLibraryDoc, SEARCH_FIELDS, SearchResult, toSearchResults } from "@/lib/openLibrary";
import { pace } from "@/lib/outbound";

const cache = createCache<SearchResult[]>(24 * 60 * 60 * 1000);

// Proxies Open Library search so the browser stays same-origin.
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });
  const cached = cache.get(q.toLowerCase());
  if (cached) return Response.json({ results: cached });
  const url =
    `https://openlibrary.org/search.json?limit=8&fields=${SEARCH_FIELDS}&q=` + encodeURIComponent(q);
  try {
    await pace("openlibrary", 5_000);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return Response.json({ error: "Search failed" }, { status: 502 });
    const data: { docs?: OpenLibraryDoc[] } = await res.json();
    const results = toSearchResults(data.docs);
    cache.set(q.toLowerCase(), results);
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Search failed" }, { status: 502 });
  }
}
