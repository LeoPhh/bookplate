import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { applyCsvImport, CsvImportError, previewCsvImport } from "@/lib/csvImport";
import { checkNewBooks, overLimit, tooLarge } from "@/lib/limits";

// A CSV of tens of thousands of books is a few MB; this is plenty.
const MAX_BYTES = 50 * 1024 * 1024;

// POST a Goodreads or StoryGraph CSV export. With mode=preview it only
// reports what would happen; with mode=apply it saves the books.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode");
  if (!(file instanceof Blob)) return Response.json({ error: "No file uploaded" }, { status: 400 });
  const large = tooLarge(file.size, Math.min(MAX_BYTES, config.limits.importBytes), "That file");
  if (large) return large;
  if (mode !== "preview" && mode !== "apply") return Response.json({ error: "Invalid mode" }, { status: 400 });
  const text = await file.text();
  try {
    // Checked on preview too, so the reader hears before choosing Import.
    const summary = await previewCsvImport(auth.userId, text);
    const over = await checkNewBooks(auth.userId, summary.added);
    if (over) return overLimit(over);
    if (mode === "preview") return Response.json({ summary });
    return Response.json(await applyCsvImport(auth.userId, text));
  } catch (e) {
    if (e instanceof CsvImportError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
