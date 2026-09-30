// New ids for books and words, created in the browser.
//
// crypto.randomUUID() only exists on secure pages (HTTPS or localhost), but
// self-hosters often open Bookplate over plain http on their network
// (http://192.168.x.x:3000), where calling it throws. crypto.getRandomValues
// works everywhere, so build the same kind of random (version 4) UUID from it
// when randomUUID is missing.
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
