import { config } from "./config";

// Set by proxy.ts on sign-in and sign-up requests, for Better Auth's own
// rate limits (lib/auth.ts), so they count the same address ours do.
export const CLIENT_IP_HEADER = "x-bookplate-client-ip";

// The visitor's address, as the nearest trusted proxy saw it.
//
// Each proxy adds the address it received the request from to the end of
// X-Forwarded-For, but anything before that came from the visitor and can be
// made up. So count TRUSTED_PROXIES entries in from the right. With no proxy
// at all, Next.js fills in the connection's address — unless the visitor sent
// the header themselves, which is why limits by address are only as good as
// the proxy in front.
export function clientIp(headers: Headers | undefined): string {
  const entries = (headers?.get("x-forwarded-for") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return entries[Math.max(0, entries.length - config.trustedProxies)] ?? "unknown";
}
