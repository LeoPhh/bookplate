// Open Library search results, shaped for the add-book form.
//
// Each result carries the Open Library *work* id (e.g. OL893415W): one id for
// a book across all its editions. Bookplate stores it on books added from the
// catalogue, so they can later be linked to a shared book catalogue and its
// public pages.

export interface OpenLibraryDoc {
  key?: string; // "/works/OL893415W"
  title?: string;
  author_name?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  first_publish_year?: number;
}

export interface SearchResult {
  title: string;
  author: string;
  pages: number | null;
  coverId: number | null;
  year: number | null;
  workId: string | null;
}

export const SEARCH_FIELDS = "key,title,author_name,number_of_pages_median,cover_i,first_publish_year";

const WORK_ID_RE = /^OL\d+W$/;

export function isWorkId(value: unknown): value is string {
  return typeof value === "string" && WORK_ID_RE.test(value);
}

// "/works/OL893415W" → "OL893415W"; anything else → null.
export function workIdFromKey(key: string | undefined): string | null {
  const id = key?.match(/^\/works\/(OL\d+W)$/)?.[1];
  return id ?? null;
}

export function toSearchResults(docs: OpenLibraryDoc[] | undefined): SearchResult[] {
  return (docs ?? [])
    .filter((d) => d.title)
    .map((d) => ({
      title: d.title as string,
      author: d.author_name?.[0] ?? "",
      pages: d.number_of_pages_median ?? null,
      coverId: d.cover_i ?? null,
      year: d.first_publish_year ?? null,
      workId: workIdFromKey(d.key),
    }));
}
