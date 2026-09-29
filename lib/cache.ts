// A small in-memory cache for lookups against outside services (Open
// Library, Wiktionary), so repeated searches don't hit them again.
export function createCache<T>(ttlMs: number, maxEntries = 500) {
  const entries = new Map<string, { value: T; expires: number }>();
  return {
    get(key: string): T | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expires < Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T) {
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
      entries.set(key, { value, expires: Date.now() + ttlMs });
    },
  };
}
