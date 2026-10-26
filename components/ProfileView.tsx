import Avatar from "@/components/Avatar";
import BookCover from "@/components/BookCover";
import ProgressBar from "@/components/ProgressBar";
import ShowcaseView, { plural } from "@/components/ShowcaseView";
import StarRating from "@/components/StarRating";
import type { Person } from "@/lib/social/people";
import type { ProfileStats } from "@/lib/social/profileStats";
import type { Taste } from "@/lib/social/taste";
import type { Book } from "@/lib/types";

// A reader's profile page (app/u/[handle]): who they are, their reading in
// numbers, what they're reading now, what they finished lately, and a year
// in books as a showcase showed it. Everything it gets is already cut down to
// what this viewer may see (lib/social/people.ts).

const num = (n: number) => n.toLocaleString("en-GB");
const COMMON_MAX = 24;

const VISIBILITY_NOTE = {
  private: "Only you can see this page.",
  friends: "Your friends can see this page.",
  public: "Anyone with the link can see this page.",
} as const;

function Shelf({ books, rated }: { books: Book[]; rated: boolean }) {
  return (
    <ol className="showcase-shelf">
      {books.map((b) => (
        <li key={b.id} className="showcase-cover profile-book" title={`${b.title} by ${b.author}`}>
          <BookCover book={b} />
          {rated && b.rating > 0 && <StarRating value={b.rating} size="sm" />}
        </li>
      ))}
    </ol>
  );
}

export default function ProfileView({
  person,
  stats,
  taste,
  today,
  yearHref,
  actions,
}: {
  person: Person;
  stats: ProfileStats;
  taste?: Taste | null; // how the viewer's reading compares; null on their own page or signed out
  today: string;
  yearHref: (year: number) => string;
  actions?: React.ReactNode; // friend and block buttons, for other signed-in readers
}) {
  const { profile, name } = person;
  const self = person.audience === "self";
  const { totals } = stats;
  const tiles = [
    { label: "Books read", value: num(totals.books), note: totals.since ? `since ${totals.since}` : "" },
    totals.pages > 0 && { label: "Pages", value: num(totals.pages), note: "" },
    totals.rating !== undefined && { label: "Average rating", value: totals.rating.toFixed(1), note: "" },
    stats.genre && { label: "Favourite genre", value: stats.genre.name, note: plural(stats.genre.books, "book"), text: true },
    stats.author && { label: "Most read", value: stats.author.name, note: plural(stats.author.books, "book"), text: true },
    // Matching books across libraries is approximate, hence "about".
    taste?.match !== undefined && {
      label: "Taste match",
      value: `${taste.match}%`,
      note: `about, from ${plural(taste.rated, "book")} you’ve both rated`,
    },
  ].filter((t): t is { label: string; value: string; note: string; text?: boolean } => Boolean(t));

  return (
    <>
      {self && (
        <p className="showcase-note">
          {VISIBILITY_NOTE[profile.visibility]} This is what your friends see. Change it in{" "}
          <a href="/settings">Settings</a>, or find friends on <a href="/friends">Friends</a>.
        </p>
      )}

      <section className="profile-head">
        <Avatar image={person.image} size={120} />
        <div className="profile-head-body">
          <h1 className="profile-head-name">{name || `@${profile.handle}`}</h1>
          <p className="profile-head-handle">{`@${profile.handle}`}</p>
          {profile.bio && <p className="profile-head-bio">{profile.bio}</p>}
          {actions}
        </div>
      </section>

      <section className="stat-tiles showcase-stats">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <p className="stat-tile-label">{t.label}</p>
            <p className={t.text ? "stat-tile-value profile-tile-text" : "stat-tile-value"}>{t.value}</p>
            {t.note && <p className="showcase-stat-note">{t.note}</p>}
          </div>
        ))}
      </section>

      {stats.reading.length > 0 && (
        <section className="showcase-section">
          <div className="showcase-section-head showcase-section-head--ruled">
            <h2 className="showcase-heading">Reading now</h2>
          </div>
          <ul className="showcase-best">
            {stats.reading.map(({ book, percent }) => (
              <li key={book.id}>
                <div className="showcase-cover">
                  <BookCover book={book} />
                </div>
                <p className="showcase-best-title">{book.title}</p>
                <p className="showcase-best-author">{book.author}</p>
                {percent !== undefined && (
                  <span className="cover-progress">
                    <ProgressBar percent={percent} size="sm" />
                    <span className="cover-progress-value">{percent}%</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.recent.length > 0 && (
        <section className="showcase-section">
          <div className="showcase-section-head showcase-section-head--ruled">
            <h2 className="showcase-heading">Recently finished</h2>
            {stats.toRead > 0 && <p className="showcase-section-note">{`${plural(stats.toRead, "book")} to read next`}</p>}
          </div>
          <Shelf books={stats.recent} rated={profile.shareRatings} />
        </section>
      )}

      {taste && taste.common.length > 0 && (
        <section className="showcase-section">
          <div className="showcase-section-head showcase-section-head--ruled">
            <h2 className="showcase-heading">You&rsquo;ve both read</h2>
            <p className="showcase-section-note">{`About ${plural(taste.common.length, "book")}`}</p>
          </div>
          <Shelf books={taste.common.slice(0, COMMON_MAX)} rated={profile.shareRatings} />
        </section>
      )}

      <section className="showcase-section profile-year">
        <div className="showcase-section-head showcase-section-head--ruled">
          <h2 className="showcase-heading">A year in books</h2>
          {stats.years.length > 1 && (
            <nav className="profile-years" aria-label="Year">
              {stats.years.map((y) => (
                <a
                  key={y.year}
                  href={yearHref(y.year)}
                  className={y.year === stats.year.year ? "profile-year-link profile-year-link--active" : "profile-year-link"}
                  aria-current={y.year === stats.year.year ? "page" : undefined}
                >
                  {y.year}
                </a>
              ))}
            </nav>
          )}
        </div>
        <ShowcaseView name={name || null} view={stats.year} today={today} />
      </section>
    </>
  );
}
