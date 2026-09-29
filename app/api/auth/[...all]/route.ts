import { getAuth } from "@/lib/auth";

// Better Auth's endpoints: sign-up, sign-in, sign-out, session.
export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
