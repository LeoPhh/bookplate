import Avatar from "@/components/Avatar";
import BookCover from "@/components/BookCover";
import FriendsTile from "@/components/FriendsTile";
import ProgressBar from "@/components/ProgressBar";
import ShareProfile from "@/components/ShareProfile";
import { plural } from "@/components/ShowcaseView";
import StarRating from "@/components/StarRating";
import type { Someone } from "@/lib/social/friends";
import type { Person } from "@/lib/social/people";
import type { ProfileStats } from "@/lib/social/profileStats";
import type { Taste } from "@/lib/social/taste";
import type { Book } from "@/lib/types";

// A reader's profile page (app/u/[handle]): who they are, their reading in
// numbers and their friends, what they're reading now and what they finished
// lately. Everything it gets is already cut down to what this viewer may see
// (lib/social/people.ts): anyone sees who the reader is and their friends;
// the reading only as the profile's visibility allows.

const num = (n: number) => n.toLocaleString("en-GB");
const COMMON_MAX = 24;

const FRIENDS_SHOWN = 5;

// Angular line icons on a 32px grid, drawn in the accent before each tile's
// label, as on the landing page's cards.
const ICONS = {
  // A closed book with a bookmark ribbon.
  books: (
    <>
      <path d="M6 3 H26 V29 H6 Z" />
      <path d="M11 3 V29" />
      <path d="M17 3 V14 L19.5 11.5 L22 14 V3" />
    </>
  ),
  // A page with its corner turned, and lines of text.
  pages: (
    <>
      <path d="M7 3 H20 L26 9 V29 H7 Z" />
      <path d="M20 3 V9 H26" />
      <path d="M11 15 H22" />
      <path d="M11 20 H22" />
      <path d="M11 25 H17" />
    </>
  ),
  // A five-pointed star.
  rating: <path d="M16 3 L19.8 11.6 L29 12.4 L22 18.6 L24.1 27.8 L16 23 L7.9 27.8 L10 18.6 L3 12.4 L12.2 11.6 Z" />,
  // Two readers, side by side.
  friends: (
    <>
      <path d="M7 5 H14 V12 H7 Z" />
      <path d="M3 28 V20 L6 16 H15 L18 20 V28" />
      <path d="M19 8 H25 V14 H19 Z" />
      <path d="M21 18 H26 L29 22 V28 H22" />
    </>
  ),
  // A padlock: reading kept from this viewer.
  hidden: (
    <>
      <path d="M6 14 H26 V29 H6 Z" />
      <path d="M10 14 V9 L13 4 H19 L22 9 V14" />
      <path d="M16 19 V24" />
    </>
  ),
  // Two shelves overlapping: what you have in common.
  taste: (
    <>
      <path d="M3 9 H19 V25 H3 Z" />
      <path d="M13 6 H29 V22 H13" />
    </>
  ),
};

function TileHead({ icon, label }: { icon: keyof typeof ICONS; label: string }) {
  return (
    <div className="profile-tile-head">
      <svg className="profile-tile-icon" viewBox="0 0 32 32" aria-hidden="true">
        {ICONS[icon]}
      </svg>
      <p className="stat-tile-label">{label}</p>
    </div>
  );
}

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
  actions,
  friends,
  shareUrl,
}: {
  person: Person;
  stats: ProfileStats;
  taste?: Taste | null; // how the viewer's reading compares; null on their own page or signed out
  actions?: React.ReactNode; // friend and block buttons, for other signed-in readers
  // The reader's friends (less anyone blocked with the viewer), and where the
  // full list is; `news` is
  // how much is waiting there for the owner (requests, recommendations).
  friends: { all: Someone[]; href: string; news?: number };
  shareUrl?: string; // the owner's own page: the Share button's link
}) {
  const { profile, name } = person;
  const { totals } = stats;
  const reading = person.seesReading;
  const tiles = [
    { icon: "books", label: "Books read", value: num(totals.books), note: "" },
    totals.pages > 0 && { icon: "pages", label: "Pages", value: num(totals.pages), note: "" },
    totals.rating !== undefined && { icon: "rating", label: "Average rating", value: totals.rating.toFixed(1), note: "" },
    // Matching books across libraries is approximate, hence "about".
    taste?.match !== undefined && {
      icon: "taste",
      label: "Taste match",
      value: `${taste.match}%`,
      note: `about, from ${plural(taste.rated, "book")} you’ve both rated`,
    },
  ].filter((t): t is { icon: keyof typeof ICONS; label: string; value: string; note: string } => Boolean(t));

  return (
    <>
      <section className="profile-head">
        <Avatar image={person.image} size={120} />
        <div className="profile-head-body">
          <div className="profile-head-row">
            <h1 className="profile-head-name">{name || `@${profile.handle}`}</h1>
            {shareUrl && (
              <div className="profile-head-tools">
                <ShareProfile url={shareUrl} name={name} visibility={profile.visibility} />
                <a className="btn" href="/settings">
                  Edit profile
                </a>
              </div>
            )}
          </div>
          <p className="profile-head-handle">{`@${profile.handle}`}</p>
          {profile.bio && <p className="profile-head-bio">{profile.bio}</p>}
          {actions}
        </div>
      </section>

      <section className="profile-stats">
        <div className="profile-numbers">
          {!reading && (
            <div className="stat-tile profile-hidden">
              <TileHead icon="hidden" label="Reading" />
              <p className="profile-hidden-text">
                {profile.visibility === "friends"
                  ? `${name || `@${profile.handle}`} shares their books and numbers with friends only.`
                  : `${name || `@${profile.handle}`} keeps their books and numbers private.`}
              </p>
            </div>
          )}
          {reading &&
            tiles.map((t) => (
              <div key={t.label} className="stat-tile">
                <TileHead icon={t.icon} label={t.label} />
                <p className="stat-tile-value">{t.value}</p>
                {t.note && <p className="showcase-stat-note">{t.note}</p>}
              </div>
            ))}
        </div>
        <FriendsTile
          href={friends.href}
          list={person.audience === "self" ? null : { title: `${name || `@${profile.handle}`}’s friends`, friends: friends.all }}
        >
          <TileHead icon="friends" label="Friends" />
          <div className="profile-friends-body">
            <p className="stat-tile-value">{num(friends.all.length)}</p>
            {friends.all.length > 0 && (
              <span className="profile-friends-faces" aria-hidden="true">
                {friends.all.slice(0, FRIENDS_SHOWN).map((f) => (
                  <Avatar key={f.id} image={f.image} size={40} />
                ))}
              </span>
            )}
          </div>
          <p className="showcase-stat-note profile-friends-more">
            {friends.news ? <span className="profile-friends-news">{`${friends.news} new`}</span> : null}
            {friends.all.length > 0 ? "See all" : person.audience === "self" ? "Find friends" : "None to show yet"}
          </p>
        </FriendsTile>
      </section>

      {reading && stats.reading.length > 0 && (
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

      {reading && stats.recent.length > 0 && (
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

    </>
  );
}
