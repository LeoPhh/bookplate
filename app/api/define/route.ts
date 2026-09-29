import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCache } from "@/lib/cache";
import { USER_AGENT } from "@/lib/config";

interface WiktDefinition {
  definition?: string;
  examples?: string[];
  parsedExamples?: { example?: string }[];
}

interface WiktUsage {
  partOfSpeech?: string;
  language?: string;
  definitions?: WiktDefinition[];
}

// Wiktionary's definition endpoint returns usages keyed by language code.
type WiktResponse = Record<string, WiktUsage[]>;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

// Definitions and examples arrive as HTML fragments (wiki links, usage-label
// spans); the page renders plain text.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? m;
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

// Wiktionary lookups for a headword, including "no entry" (null) answers.
const cache = createCache<WiktUsage[] | null>(24 * 60 * 60 * 1000);

async function fetchUsages(title: string): Promise<WiktUsage[] | null> {
  const cached = cache.get(title);
  if (cached !== undefined) return cached;
  const url = "https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(title);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) {
    cache.set(title, null);
    return null;
  }
  if (!res.ok) throw new Error("Lookup failed");
  const data: WiktResponse = await res.json();
  const english = data.en ?? [];
  const usages = english.length > 0 ? english : null;
  cache.set(title, usages);
  return usages;
}

// Proxies Wiktionary's REST definition API so the browser stays same-origin.
// Returns { entry: null } when the word has no English entry. Wiktionary
// carries no pronunciation or synonyms in this endpoint, so those stay empty.
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const raw = request.nextUrl.searchParams.get("word")?.trim();
  if (!raw) return Response.json({ entry: null });
  const word = raw.toLowerCase();
  try {
    // Wiktionary titles are case-sensitive: try the lowercase headword first,
    // then the spelling as typed (proper nouns, acronyms).
    let headword = word;
    let usages = await fetchUsages(word);
    if (!usages && raw !== word) {
      headword = raw;
      usages = await fetchUsages(raw);
    }
    if (!usages) return Response.json({ entry: null });

    const senses = usages
      .flatMap((u) =>
        (u.definitions ?? []).map((d) => {
          const example = d.parsedExamples?.[0]?.example ?? d.examples?.[0];
          return {
            partOfSpeech: (u.partOfSpeech ?? "").toLowerCase(),
            definition: stripHtml(d.definition ?? ""),
            example: example ? stripHtml(example) || null : null,
            synonyms: [] as string[],
          };
        })
      )
      .filter((s) => s.definition)
      .slice(0, 10);

    return Response.json({ entry: { word: headword, phonetic: null, senses } });
  } catch {
    return Response.json({ error: "Lookup failed" }, { status: 502 });
  }
}
