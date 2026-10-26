import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { paletteFor } from "@/lib/palette";
import { loadPersonView, findPerson } from "@/lib/social/people";
import { getStorage, isSafeFileName, keys } from "@/lib/storage";
import type { Book } from "@/lib/types";

// The picture shown when a public profile's link is pasted into a chat or a
// post: the reader, their numbers, and a few covers. Link previews are
// fetched signed out, so only public profiles have one, and only their page
// links to it (app/u/[handle]/page.tsx). A plain route rather than Next's
// opengraph-image file, which would put preview tags on every profile page.

export const CARD_SIZE = { width: 1200, height: 630 };

const INK = "#111111";
const PAPER = "#f4f2ec";
const ACCENT = "#ff3b1f";
const COVERS = 5;

// The cover photo as a data address (the renderer can't fetch our own
// routes), or null for a generated cover. Only covers of books the profile
// shows to anyone, which carry the profile's own cover address.
async function photo(userId: string, handle: string, book: Book): Promise<string | null> {
  const m = book.coverImage?.match(new RegExp(`^/u/${handle}/covers/([^/?]+)`));
  if (!m || !isSafeFileName(m[1])) return null;
  const data = await getStorage()
    .get(keys.cover(userId, m[1]))
    .catch(() => null);
  return data ? `data:image/jpeg;base64,${Buffer.from(data).toString("base64")}` : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!config.social) return new Response("Not found", { status: 404 });
  const person = await findPerson(null, (await params).handle);
  if (!person) return new Response("Not found", { status: 404 });
  const { stats } = await loadPersonView(person, { viewerId: null });
  const { profile } = person;
  const covers = await Promise.all(
    stats.recent.slice(0, COVERS).map(async (b) => ({ book: b, src: await photo(person.userId, profile.handle, b) }))
  );

  const facts = [
    `${stats.totals.books.toLocaleString("en-GB")} ${stats.totals.books === 1 ? "book" : "books"} read`,
    stats.totals.pages ? `${stats.totals.pages.toLocaleString("en-GB")} pages` : null,
    // Words, not a ★: the renderer would fetch a font from the internet for it.
    stats.totals.rating !== undefined ? `rated ${stats.totals.rating.toFixed(1)}` : null,
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
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1, marginTop: 16 }}>
              {(person.name || `@${profile.handle}`).slice(0, 40)}
            </div>
            <div style={{ display: "flex", fontSize: 28, marginTop: 14, color: ACCENT }}>{`@${profile.handle}`}</div>
            {profile.bio && <div style={{ display: "flex", fontSize: 24, marginTop: 14 }}>{profile.bio.slice(0, 90)}</div>}
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
              // The card is drawn by ImageResponse, not a browser: next/image doesn't apply.
              // eslint-disable-next-line @next/next/no-img-element
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
    { ...CARD_SIZE, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
