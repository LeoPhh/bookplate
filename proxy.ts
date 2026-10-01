import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_IP_HEADER, clientIp } from "./lib/clientIp";

// An optimistic gate: anyone without a session cookie is sent to sign in.
// Real checks happen in every route handler (requireUser), which also
// verifies the session itself.
const PUBLIC = ["/login", "/setup", "/signup", "/forgot-password", "/reset-password", "/api/auth", "/api/health", "/api/signup-challenge"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Sign-in rate limits key on the visitor's address: work it out once here,
  // replacing anything the visitor sent under the same name.
  if (pathname.startsWith("/api/auth/")) {
    const headers = new Headers(request.headers);
    headers.set(CLIENT_IP_HEADER, clientIp(request.headers));
    return NextResponse.next({ request: { headers } });
  }
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except Next's own assets, the app icons/manifest, and
  // /api/import: Proxy buffers request bodies and silently cuts them off at
  // 10 MB, which a library export easily exceeds. The import route checks
  // the session itself.
  matcher: ["/((?!_next/|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|api/import).*)"],
};
