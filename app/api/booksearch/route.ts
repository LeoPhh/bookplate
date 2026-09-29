import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCache } from "@/lib/cache";
import { USER_AGENT } from "@/lib/config";

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  first_publish_year?: number;
}

interface SearchResult {
  title: string;
  author: string;
  pages: number | null;
  coverId: number | null;
  year: number | null;
}

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
    "https://openlibrary.org/search.json?limit=8&fields=title,author_name,number_of_pages_median,cover_i,first_publish_year&q=" +
    encodeURIComponent(q);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return Response.json({ error: "Search failed" }, { status: 502 });
    const data: { docs?: OpenLibraryDoc[] } = await res.json();
    const results: SearchResult[] = (data.docs ?? [])
      .filter((d) => d.title)
      .map((d) => ({
        title: d.title as string,
        author: d.author_name?.[0] ?? "",
        pages: d.number_of_pages_median ?? null,
        coverId: d.cover_i ?? null,
        year: d.first_publish_year ?? null,
      }));
    cache.set(q.toLowerCase(), results);
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Search failed" }, { status: 502 });
  }
}
