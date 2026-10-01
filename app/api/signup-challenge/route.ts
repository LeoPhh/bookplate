import { newChallenge } from "@/lib/botCheck";
import { config } from "@/lib/config";

// A fresh sign-up puzzle (see lib/botCheck.ts). Public: it's for people who
// don't have an account yet.
export async function GET() {
  if (!config.signupBotCheck) return Response.json({ error: "Not used on this server" }, { status: 404 });
  return Response.json(await newChallenge(), { headers: { "Cache-Control": "no-store" } });
}
