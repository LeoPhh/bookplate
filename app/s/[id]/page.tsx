import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, type CSSProperties } from "react";
import BookCover from "@/components/BookCover";
import ProgressBar from "@/components/ProgressBar";
import { getSession } from "@/lib/auth";
import { config, CONTACT_EMAIL } from "@/lib/config";
import { loadShowcase } from "@/lib/showcase";
import { MONTHS, possessive } from "@/lib/showcaseYear";
import { todayIso } from "@/lib/progress";

// A showcase: one reader's year of reading, public to anyone with the link
// (lib/showcase.ts). Live: it reads the library each time it's opened.

const load = cache(loadShowcase);
const PROJECT_URL = "https://github.com/LeoPhh/bookplate";

const num = (n: number) => n.toLocaleString("en-GB");
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

function heading(name: string | null, year: number) {
  return name ? `${possessive(name)} ${year} in books` : `A ${year} in books`;
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).id);
  if (!found) return { title: "Bookplate", robots: { index: false, follow: false } };
  const { showcase, view } = found;
  const title = heading(showcase.name, showcase.year);
  const description = view.read.length
    ? `${plural(view.read.length, "book")} read in ${showcase.year}, kept on Bookplate.`
    : `What’s being read in ${showcase.year}, kept on Bookplate.`;
  return {
    title: `${title} · Bookplate`,
    description,
    // Only people given the link should find it.
    robots: { index: false, follow: false },
    metadataBase: new URL(config.publicUrl),
    openGraph: { title, description, type: "website", siteName: "Bookplate" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ShowcasePage({ params }: Props) {
  const { id } = await params;
  const found = await load(id);
  if (!found) notFound();
  const { showcase, userId, view } = found;
  const session = await getSession().catch(() => null);
  const owner = session?.user.id === userId;
  const signup = config.registration === "open";

  const thisYear = Number(todayIso().slice(0, 4));
  const thisMonth = Number(todayIso().slice(5, 7)) - 1;
  const { stats } = view;
  const tiles = [
    view.read.length > 0 && {
      label: "Books read",
      value: num(stats.books),
      note: view.reading.length ? `and ${view.reading.length} on the go` : showcase.year === thisYear ? "so far" : "",
    },
    stats.pages > 0 && { label: "Pages", value: num(stats.pages), note: `about ${num(stats.pagesPerDay ?? 0)} a day` },
    stats.rating !== undefined && {
      label: "Average rating",
      value: stats.rating.toFixed(1),
      note: view.favourites.length ? plural(view.favourites.length, "five-star read") : "",
    },
    stats.longest && { label: "Longest", value: num(stats.longest.pages), note: `pages · ${stats.longest.title}` },
  ].filter((t): t is { label: string; value: string; note: string } => Boolean(t));

  const reportHref = CONTACT_EMAIL
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Report a showcase")}&body=${encodeURIComponent(
        `${config.publicUrl}/s/${id}\n\nWhat's wrong with it:\n`,
      )}`
    : null;

  return (
    <main className="page showcase">
      {owner ? (
        <p className="showcase-note">This is your showcase. Change it or turn it off in Settings → Showcase.</p>
      ) : (
        !session && (
          <div className="showcase-top">
            <p>A year of reading, kept on Bookplate.</p>
            {signup ? (
              <a className="btn btn--accent" href="/signup">
                Start your own library
              </a>
            ) : (
              <a className="btn" href={PROJECT_URL}>
                What’s Bookplate?
              </a>
            )}
          </div>
        )
      )}

      <section className="showcase-plate">
        <p className="showcase-plate-eyebrow">Ex libris</p>
        <h1 className="showcase-plate-name">{showcase.name ? `${possessive(showcase.name)} Library` : showcase.year}</h1>
        <p className="showcase-plate-edition">{showcase.name ? `The ${showcase.year} edition` : "A year in books"}</p>
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
                className={
                  showcase.year === thisYear && i > thisMonth ? "showcase-month showcase-month--ahead" : "showcase-month"
                }
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
        <p className="showcase-empty">Nothing on the shelf for {showcase.year} yet.</p>
      )}

      {!session && (
        <section className="showcase-cta">
          {signup ? (
            <>
              <p className="showcase-cta-title">
                {showcase.name ? `Keep a library like ${possessive(showcase.name)}.` : "Keep a library like this one."}
              </p>
              <p className="showcase-cta-text">
                Bookplate is a free home for your books, your notes on them and the words you learn along the way.
              </p>
              <a className="btn btn--accent showcase-cta-button" href="/signup">
                Create a free account
              </a>
            </>
          ) : (
            <>
              <p className="showcase-cta-title">Kept on Bookplate.</p>
              <p className="showcase-cta-text">
                A home for your books, your notes on them and the words you learn. Free and open source.
              </p>
              <a className="btn showcase-cta-button" href={PROJECT_URL}>
                See Bookplate
              </a>
            </>
          )}
        </section>
      )}

      <footer className="showcase-footer">
        <span>Made with Bookplate</span>
        {reportHref && <a href={reportHref}>Report this page</a>}
      </footer>
    </main>
  );
}
