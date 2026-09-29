import { requireUser } from "@/lib/auth";
import { buildExport } from "@/lib/archive";

// GET downloads the signed-in user's whole library as a zip.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const zip = await buildExport(auth.userId);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(zip as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="bookplate-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
