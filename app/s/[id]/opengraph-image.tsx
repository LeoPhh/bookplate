import { ImageResponse } from "next/og";
import { paletteFor } from "@/lib/palette";
import { coverFileOf, loadShowcase } from "@/lib/showcase";
import { possessive } from "@/lib/showcaseYear";
import { getStorage, isSafeFileName, keys } from "@/lib/storage";
import type { Book } from "@/lib/types";

// The picture shown when a showcase link is pasted into a chat or a post: the
// name and year, the year's numbers, and a few of its covers.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A year of reading on Bookplate";

const INK = "#111111";
const PAPER = "#f4f2ec";
const ACCENT = "#ff3b1f";
const COVERS = 5;

// The cover photo as a data address (the renderer can't fetch our own routes),
// or null for a generated cover.
async function photo(userId: string, book: Book, view: Parameters<typeof coverFileOf>[0]): Promise<string | null> {
  const file = book.coverImage?.split("?")[0].split("/").pop();
  if (!file || !isSafeFileName(file) || !coverFileOf(view, file)) return null;
  const data = await getStorage()
    .get(keys.cover(userId, file))
    .catch(() => null);
  return data ? `data:image/jpeg;base64,${Buffer.from(data).toString("base64")}` : null;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const found = await loadShowcase((await params).id);
  if (!found) return new Response("Not found", { status: 404 });
  const { showcase, userId, view } = found;

  // Favourites first, then the most recently finished, then what's being read.
  const picks: Book[] = [];
  for (const b of [...view.favourites, ...[...view.read].reverse(), ...view.reading.map((r) => r.book)]) {
    if (picks.length < COVERS && !picks.some((p) => p.id === b.id)) picks.push(b);
  }
  const covers = await Promise.all(picks.map(async (b) => ({ book: b, src: await photo(userId, b, view) })));

  const facts = [
    view.read.length ? `${view.read.length} ${view.read.length === 1 ? "book" : "books"} read` : null,
    view.stats.pages ? `${view.stats.pages.toLocaleString("en-GB")} pages` : null,
    // Words, not a ★: the renderer would fetch a font from the internet for it.
    view.stats.rating !== undefined ? `rated ${view.stats.rating.toFixed(1)}` : null,
    !view.read.length && view.reading.length ? `${view.reading.length} on the go` : null,
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, padding: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 520 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              border: `4px solid ${INK}`,
              boxShadow: `12px 12px 0 ${INK}`,
              padding: "36px 40px",
            }}
          >
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 6, color: ACCENT }}>EX LIBRIS</div>
            <div style={{ display: "flex", fontSize: showcase.name ? 64 : 96, fontWeight: 700, lineHeight: 1, marginTop: 16 }}>
              {showcase.name ? `${possessive(showcase.name)} Library` : String(showcase.year)}
            </div>
            <div style={{ display: "flex", fontSize: 30, marginTop: 14 }}>
              {showcase.name ? `The ${showcase.year} edition` : "A year in books"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>{facts.join(" · ")}</div>
            <div style={{ display: "flex", fontSize: 24, marginTop: 10, color: "#6b6862" }}>Kept on Bookplate</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", flex: 1, marginLeft: 48 }}>
          {covers.map(({ book, src }, i) => {
            const c = paletteFor(book.colorIndex);
            const box = {
              display: "flex",
              width: 150,
              height: 225,
              margin: 10,
              border: `3px solid ${INK}`,
              boxShadow: `6px 6px 0 ${INK}`,
              transform: `rotate(${[-3, 2, -1, 3, -2][i % 5]}deg)`,
            };
            return src ? (
              <img key={book.id} src={src} alt="" width={150} height={225} style={{ ...box, objectFit: "cover" }} />
            ) : (
              <div
                key={book.id}
                style={{
                  ...box,
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "center",
                  padding: "26px 14px",
                  background: c.bg,
                  color: c.ink,
                }}
              >
                <div style={{ display: "flex", fontSize: 20, lineHeight: 1.1 }}>{book.title.slice(0, 60)}</div>
                <div style={{ display: "flex", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                  {book.author.toUpperCase().slice(0, 40)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    size,
  );
}
