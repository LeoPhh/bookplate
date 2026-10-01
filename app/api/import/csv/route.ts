import { requireUser } from "@/lib/auth";
import { applyCsvImport, CsvImportError, previewCsvImport } from "@/lib/csvImport";

const MAX_BYTES = 50 * 1024 * 1024; // a CSV of tens of thousands of books

// POST a Goodreads or StoryGraph CSV export. With mode=preview it only
// reports what would happen; with mode=apply it saves the books.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode");
  if (!(file instanceof Blob)) return Response.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That file is too large" }, { status: 413 });
  if (mode !== "preview" && mode !== "apply") return Response.json({ error: "Invalid mode" }, { status: 400 });
  const text = await file.text();
  try {
    if (mode === "preview") return Response.json({ summary: await previewCsvImport(auth.userId, text) });
    return Response.json(await applyCsvImport(auth.userId, text));
  } catch (e) {
    if (e instanceof CsvImportError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
