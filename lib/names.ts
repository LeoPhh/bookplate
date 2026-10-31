// An account's name, as given at sign-up, in Settings or in the name prompt.
export const NAME_MAX = 25;

// Words in an address that aren't anyone's name: info.team@…, no-reply@…
const NOT_NAMES = new Set(["info", "hello", "contact", "admin", "mail", "email", "support", "team", "office", "sales", "help", "billing", "no", "reply"]);

// "jane.smith92@…" → "Jane Smith": what the name prompt suggests, never saved
// without the reader's say. "" unless the address clearly holds a first and
// last name: one word could be anything (jsmith, coolcat).
export function suggestName(email: string): string {
  const words = email
    .split("@")[0]
    .split("+")[0]
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .split(/[._-]+/)
    .filter(Boolean);
  if (words.length < 2 || words.length > 3) return "";
  if (words.some((w) => !/^\p{L}{2,}$/u.test(w) || NOT_NAMES.has(w))) return "";
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return [...name].length <= NAME_MAX ? name : "";
}
