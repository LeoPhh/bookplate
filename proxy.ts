import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_IP_HEADER, clientIp } from "./lib/clientIp";
import { REQUEST_ID_HEADER } from "./lib/log";

// An optimistic gate: anyone without a session cookie is sent to sign in.
// Real checks happen in every route handler (requireUser), which also
// verifies the session itself.
const PUBLIC = [
  "/login",
  "/setup",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/health",
  "/api/signup-challenge",
  "/api/client-errors",
  "/api/contact",
  "/api/metrics", // checks its own token
  "/privacy",
  "/terms",
];

// A reverse proxy's request ID (Caddy sets one) is kept, so its access log
// and ours line up; otherwise each request gets a fresh one.
const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  const requestId = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  // Sign-in rate limits key on the visitor's address: work it out once here,
  // replacing anything the visitor sent under the same name.
  if (pathname.startsWith("/api/auth/")) headers.set(CLIENT_IP_HEADER, clientIp(request.headers));

  // Sent back too, so an error report can quote it.
  const tag = <T extends Response>(res: T) => {
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  };
  const pass = () => tag(NextResponse.next({ request: { headers } }));

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return pass();
  if (getSessionCookie(request)) return pass();
  if (pathname.startsWith("/api/")) return tag(Response.json({ error: "Not signed in" }, { status: 401 }));
  return tag(NextResponse.redirect(new URL("/login", request.url)));
}

export const config = {
  // Everything except Next's own assets, the app icons/manifest, and
  // /api/import: Proxy buffers request bodies and silently cuts them off at
  // 10 MB, which a library export easily exceeds. The import route checks
  // the session itself.
  matcher: ["/((?!_next/|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|api/import).*)"],
};
