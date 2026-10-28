// Where to go after signing in or up (?next=…), e.g. back to a profile.
// Only a plain path on this server: never another site ("//evil.example",
// "https://…") or anything with odd characters. null = the library.
export function safeNext(raw: string | undefined | null): string | null {
  if (!raw || raw.length > 200) return null;
  return /^\/(?![/\\])[A-Za-z0-9_\-/]*$/.test(raw) ? raw : null;
}
