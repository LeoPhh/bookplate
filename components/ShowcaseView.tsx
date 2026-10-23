import type { CSSProperties } from "react";
import BookCover from "@/components/BookCover";
import ProgressBar from "@/components/ProgressBar";
import { MONTHS, possessive, type ShowcaseYear } from "@/lib/showcaseYear";

// The body of a showcase: a bookplate with the reader's name, the year's
// numbers, every book under the month it was finished, what's being read and
// the five-star reads. The public page (app/s/[id]) and its owner's previews
// (app/showcase) both show it, so a preview is exactly what visitors see.

const num = (n: number) => n.toLocaleString("en-GB");
export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

export function showcaseHeading(name: string | null, year: number) {
  return name ? `${possessive(name)} ${year} in books` : `A ${year} in books`;
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
  const thisMonth = Number(today.slice(5, 7)) - 1;
  const tiles = [
    view.read.length > 0 && {
      label: "Books read",
      value: num(stats.books),
      note: view.reading.length ? `and ${view.reading.length} on the go` : year === thisYear ? "so far" : "",
    },
    stats.pages > 0 && { label: "Pages", value: num(stats.pages), note: `about ${num(stats.pagesPerDay ?? 0)} a day` },
    stats.rating !== undefined && {
      label: "Average rating",
      value: stats.rating.toFixed(1),
      note: view.favourites.length ? plural(view.favourites.length, "five-star read") : "",
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
        <section className="showcase-stats" style={{ "--tiles": tiles.length } as CSSProperties}>
          {tiles.map((t) => (
            <div key={t.label} className="showcase-stat">
              <p className="showcase-stat-label">{t.label}</p>
              <p className="showcase-stat-value">{t.value}</p>
              {t.note && <p className="showcase-stat-note">{t.note}</p>}
            </div>
          ))}
        </section>
      )}

      {view.read.length > 0 && (
        <section className="showcase-section">
          <div className="showcase-section-head">
            <h2 className="showcase-heading">The year on the shelf</h2>
            <p className="showcase-section-note">Each book under the month it was finished</p>
          </div>
          <ol className="showcase-months">
            {view.months.map((books, i) => (
              <li
                key={MONTHS[i]}
                className={year === thisYear && i > thisMonth ? "showcase-month showcase-month--ahead" : "showcase-month"}
              >
                <p className="showcase-month-name">{MONTHS[i]}</p>
                <div className="showcase-month-books">
                  {books.map((b) => (
                    <div key={b.id} className="showcase-cover" title={`${b.title} by ${b.author}`}>
                      <BookCover book={b} />
                    </div>
                  ))}
                  {books.length === 0 && <span className="showcase-month-empty">—</span>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(view.reading.length > 0 || view.favourites.length > 0) && (
        <div className="showcase-pair">
          {view.reading.length > 0 && (
            <section className="showcase-section">
              <h2 className="showcase-heading showcase-heading--ruled">On the nightstand</h2>
              <ul className="showcase-reading">
                {view.reading.map(({ book, percent }) => (
                  <li key={book.id}>
                    <div className="showcase-cover showcase-cover--small">
                      <BookCover book={book} />
                    </div>
                    <div className="showcase-reading-body">
                      <p className="showcase-reading-title">{book.title}</p>
                      <p className="showcase-reading-author">{book.author}</p>
                      {percent !== undefined && (
                        <div className="showcase-reading-progress">
                          <ProgressBar percent={percent} />
                          <span>{percent}%</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {view.favourites.length > 0 && (
            <section className="showcase-section">
              <h2 className="showcase-heading showcase-heading--ruled">Five stars</h2>
              <div className="showcase-favourites">
                {view.favourites.map((b) => (
                  <div key={b.id} className="showcase-cover" title={`${b.title} by ${b.author}`}>
                    <BookCover book={b} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {view.read.length === 0 && view.reading.length === 0 && (
        <p className="showcase-empty">Nothing on the shelf for {year} yet.</p>
      )}
    </>
  );
}
