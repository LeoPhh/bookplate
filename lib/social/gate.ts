import { config } from "../config";

// Social routes answer as if they didn't exist on servers without
// SOCIAL=true. Route handlers call this before anything else; pages call
// notFound() on !config.social themselves.
export function socialOff(): Response | null {
  return config.social ? null : Response.json({ error: "Not found" }, { status: 404 });
}
