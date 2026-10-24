import BookCover from "@/components/BookCover";
import type { Book } from "@/lib/types";
import { possessive, type ShowcaseYear } from "@/lib/showcaseYear";

// The body of a showcase: a bookplate with the reader's name, the year's
// numbers, every book in the order it was finished, then the best rated and
// the longest again, up close. The public page (app/s/[id]) and the Showcase tab (app/showcase)
// both show it, so the tab shows exactly what visitors see.

const num = (n: number) => n.toLocaleString("en-GB");
export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

export function showcaseHeading(name: string | null, year: number) {
  return name ? `${possessive(name)} ${year} in books` : `A ${year} in books`;
}

// A book picked out below the shelf: its cover, larger, with its title.
function Highlight({ book }: { book: Book }) {
  return (
    <li>
      <div className="showcase-cover">
        <BookCover book={book} />
      </div>
      <p className="showcase-best-title">{book.title}</p>
      <p className="showcase-best-author">{book.author}</p>
    </li>
  );
}

export default function ShowcaseView({
  name,
  view,
  today,
}: {
  name: string | null;
  view: ShowcaseYear;
  today: string; // ISO yyyy-mm-dd
}) {
  const { year, stats } = view;
  const thisYear = Number(today.slice(0, 4));
  const longest = view.read.find((b) => b.id === stats.longest?.id);
  const tiles = [
    view.read.length > 0 && {
      label: "Books read",
      value: num(stats.books),
      note: year === thisYear ? "so far" : "",
    },
    stats.pages > 0 && { label: "Pages", value: num(stats.pages), note: `about ${num(stats.pagesPerDay ?? 0)} a day` },
    stats.rating !== undefined && {
      label: "Average rating",
      value: stats.rating.toFixed(1),
      note: view.topRating === 5 ? plural(view.topRated.length, "five-star read") : "",
    },
    stats.longest && { label: "Longest", value: num(stats.longest.pages), note: `pages · ${stats.longest.title}` },
  ].filter((t): t is { label: string; value: string; note: string } => Boolean(t));

  return (
    <>
      <section className="showcase-plate">
        <p className="showcase-plate-eyebrow">Ex libris</p>
        <h1 className="showcase-plate-name">{name ? `${possessive(name)} Library` : year}</h1>
        <p className="showcase-plate-edition">{name ? `The ${year} edition` : "A year in books"}</p>
      </section>

      {tiles.length > 0 && (
        <section className="stat-tiles showcase-stats">
          {tiles.map((t) => (
            <div key={t.label} className="stat-tile">
              <p className="stat-tile-label">{t.label}</p>
              <p className="stat-tile-value">{t.value}</p>
              {t.note && <p className="showcase-stat-note">{t.note}</p>}
            </div>
          ))}
        </section>
      )}

      {view.read.length > 0 && (
        <section className="showcase-section">
          <div className="showcase-section-head">
            <h2 className="showcase-heading">The year on the shelf</h2>
            <p className="showcase-section-note">In the order they were finished</p>
          </div>
          <ol className="showcase-shelf">
            {view.read.map((b) => (
              <li key={b.id} className="showcase-cover" title={`${b.title} by ${b.author}`}>
                <BookCover book={b} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {(view.topRated.length > 0 || longest) && (
        <div className="showcase-highlights">
          {view.topRated.length > 0 && (
            <section className="showcase-section">
              <div className="showcase-section-head showcase-section-head--ruled">
                <h2 className="showcase-heading">Highest rated</h2>
                <p className="showcase-section-note">{view.topRating === 5 ? "Five stars" : `${view.topRating} stars`}</p>
              </div>
              <ul className="showcase-best">
                {view.topRated.map((b) => (
                  <Highlight key={b.id} book={b} />
                ))}
              </ul>
            </section>
          )}
          {longest && (
            <section className="showcase-section">
              <div className="showcase-section-head showcase-section-head--ruled">
                <h2 className="showcase-heading">Longest read</h2>
                <p className="showcase-section-note">{plural(stats.longest!.pages, "page")}</p>
              </div>
              <ul className="showcase-best">
                <Highlight book={longest} />
              </ul>
            </section>
          )}
        </div>
      )}

      {view.read.length === 0 && (
        <p className="showcase-empty">Nothing on the shelf for {year} yet.</p>
      )}
    </>
  );
}
