import Link from "next/link";
import Avatar from "@/components/Avatar";
import BookCover from "@/components/BookCover";
import CopyProfileLink from "@/components/CopyProfileLink";
import FriendsCard from "@/components/FriendsCard";
import GoalCard from "@/components/GoalCard";
import LogoMark from "@/components/LogoMark";
import ProfileIcon, { type ProfileIconName } from "@/components/ProfileIcon";
import StarRating from "@/components/StarRating";
import { plural } from "@/lib/progress";
import type { Someone } from "@/lib/social/friends";
import type { Person } from "@/lib/social/people";
import type { ProfileStats } from "@/lib/social/profileStats";
import type { Taste } from "@/lib/social/taste";
import type { Book } from "@/lib/types";

// A reader's profile page (app/u/[handle]): a hero with who they are and a
// bookplate, then a grid of cards. Everything it gets is already cut down to
// what this viewer may see (lib/social/people.ts). The grid has six columns:
// each row's cards share them out, so a card that isn't there leaves no hole.

const num = (n: number) => n.toLocaleString("en-GB");
const COMMON_MAX = 8;
const READING_SHOWN = 3;
// A name this long gets the smaller size in the hero.
const LONG_NAME = 14;

// Fixed colours for the bar, biggest genre first.
const SHELF_COLORS = ["#ff3b1f", "#ffd400", "#00b6d8", "#1a34d6", "#ff5fa2", "#00994d", "#b8b4aa"];

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function dayMonth(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

// "3 yrs 7 mths", from when they joined until today.
function readingFor(joined: string, today: string): string {
  const from = new Date(joined);
  const to = new Date(`${today}T00:00:00Z`);
  const months = Math.max(0, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() - (to.getUTCDate() < from.getUTCDate() ? 1 : 0));
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (months === 0) return "under a month";
  return [y ? `${y} ${y === 1 ? "yr" : "yrs"}` : "", m ? `${m} ${m === 1 ? "mth" : "mths"}` : ""].filter(Boolean).join(" ");
}

// How tall the pages would stand (about 0.1 mm each) and how many a day.
function pagesNote(pages: number, joined: string, today: string): string {
  const mm = pages / 10;
  const height = mm >= 1000 ? `${(mm / 1000).toFixed(1)} m` : `${Math.max(1, Math.round(mm / 10))} cm`;
  const days = Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(joined).getTime()) / 86400000);
  // A daily figure says little until they've been here a while.
  if (days < 30) return `A stack about ${height} tall.`;
  const perDay = Math.round(pages / days);
  return `A stack about ${height} tall, or ${num(perDay)} ${perDay === 1 ? "page" : "pages"} a day since joining.`;
}

function CardHead({ icon, children }: { icon: ProfileIconName; children: React.ReactNode }) {
  return (
    <div className="profile-card-head">
      <ProfileIcon name={icon} />
      <h2>{children}</h2>
    </div>
  );
}

function Covers({ books, rated }: { books: Book[]; rated: boolean }) {
  return (
    <ol className="profile-covers">
      {books.map((b) => (
        <li key={b.id} title={`${b.title} by ${b.author}`}>
          <div className="profile-cover">
            <BookCover book={b} />
          </div>
          {rated && b.rating > 0 && <StarRating value={b.rating} size="sm" />}
        </li>
      ))}
    </ol>
  );
}

function ReadingNow({ reading }: { reading: ProfileStats["reading"] }) {
  const shown = reading.slice(0, READING_SHOWN);
  const more = reading.length - shown.length;
  return (
    <>
      <div className="profile-card-head">
        <ProfileIcon name="open" />
        <h2>Reading now</h2>
        {more > 0 && <span className="profile-more">{`+${more} more`}</span>}
      </div>
      <ul className={`profile-reading profile-reading--${Math.min(shown.length, READING_SHOWN)}`}>
        {shown.map(({ book, percent, page }) => (
          <li key={book.id} className="profile-now">
            <div className="profile-cover">
              <BookCover book={book} />
            </div>
            <div className="profile-now-body">
              <p className="profile-now-title">{book.title}</p>
              <p className="profile-note profile-now-note">
                {book.author}
                {page !== undefined && book.pages ? ` · page ${num(page)} of ${num(book.pages)}` : percent !== undefined ? ` · ${percent}%` : ""}
              </p>
              {percent !== undefined && (
                <span className="profile-bar">
                  <i style={{ width: `${percent}%` }} />
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// A placeholder for what's coming: the same on every profile, whoever's it is,
// and using nothing of the reader's.
function Achievements({ span }: { span: string }) {
  const earned: { icon: ProfileIconName; title: string; text: string }[] = [
    { icon: "crown", title: "Century", text: "100 books finished" },
    { icon: "brick", title: "Doorstopper", text: "Read 659 pages in one book" },
    { icon: "flame", title: "On a roll", text: "Read every day for one month" },
  ];
  return (
    <section className={`profile-card profile-card--dashed ${span}`}>
      <div className="profile-card-head">
        <ProfileIcon name="crown" />
        <h2>Achievements</h2>
        <span className="profile-soon">Coming soon</span>
      </div>
      <p className="profile-note profile-ach-note">A sneak peek at what&rsquo;s on the way. These are just examples for now.</p>
      <ul className="profile-achs">
        {earned.map((a) => (
          <li key={a.title} className="profile-ach">
            <ProfileIcon name={a.icon} />
            <span>
              <b>{a.title}</b>
              <small>{a.text}</small>
            </span>
          </li>
        ))}
        <li className="profile-ach profile-ach--locked">
          <ProfileIcon name="lock" />
          <span>
            <b>Read 50,000 pages</b>
            <span className="profile-bar">
              <i style={{ width: "77%" }} />
            </span>
          </span>
        </li>
      </ul>
    </section>
  );
}

export default function ProfileView({
  person,
  stats,
  taste,
  finished,
  goal,
  today,
  actions,
  friends,
  shareUrl,
}: {
  person: Person;
  stats: ProfileStats;
  taste?: Taste | null; // how the viewer's reading compares; null on their own page or signed out
  finished: number; // how many books they've finished, whoever's looking
  goal: number | null;
  today: string;
  actions?: React.ReactNode; // friend and block buttons, for other signed-in readers
  // The reader's friends (less anyone blocked with the viewer), and where the
  // full list is; `news` is how much is waiting there for the owner.
  friends: { all: Someone[]; href: string; news?: number };
  shareUrl?: string; // the owner's own page: the address the copy button copies
}) {
  const { profile, name } = person;
  const { totals } = stats;
  const self = person.audience === "self";
  const shown = name || `@${profile.handle}`;
  const canRead = person.seesReading;

  const pages = canRead && totals.pages > 0;
  const rating = canRead && totals.rating !== undefined;
  const hasGoal = canRead && goal !== null;
  const offerGoal = self && goal === null;
  const reading = canRead && stats.reading.length > 0;
  const last = canRead && !reading ? stats.last : undefined;
  const firstBook = self && !reading && !stats.last;
  const firstRow = [pages, rating, offerGoal].filter(Boolean).length;
  // Beside a goal there are four columns to share out, otherwise six.
  const width = hasGoal ? 4 : 6;
  const stat = firstRow ? `profile-card--${width / firstRow}` : "";
  const half = pages && rating ? "profile-card--half" : "";
  const secondRow = canRead ? (reading || last || firstBook ? 2 : 1) : 2;
  const second = `profile-card--${width / secondRow}`;
  const bookWord = finished === 1 ? "book" : "books";

  return (
    <>
      <section className="profile-hero">
        <div className="profile-who">
          <span className="profile-picture">
            <Avatar image={person.image} label={shown} color={person.color} size={112} />
          </span>
          <div className="profile-who-body">
            <h1 className="profile-title">
              <span className={name.length > LONG_NAME ? "profile-title-name profile-title-name--long" : "profile-title-name"}>{shown}</span>
              {finished > 0 && <strong>{`${num(finished)} ${bookWord} deep.`}</strong>}
            </h1>
            {name && <p className="profile-handle">{`@${profile.handle}`}</p>}
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            {shareUrl && (
              <div className="profile-cta">
                <CopyProfileLink url={shareUrl} />
                <a className="btn" href="/settings">
                  Edit profile
                </a>
              </div>
            )}
            {actions}
          </div>
        </div>
        <div className="profile-plate">
          <p className="profile-plate-eyebrow">Ex Libris</p>
          <LogoMark />
          <p className="profile-plate-from">from the library of</p>
          <p className="profile-plate-name">{shown}</p>
          <div className="profile-plate-rule" />
          <p className="profile-plate-label">Joined</p>
          <p className="profile-plate-date">{monthYear(person.joined)}</p>
          <p className="profile-plate-for">{`Reading for ${readingFor(person.joined, today)}`}</p>
        </div>
      </section>

      <div className="profile-grid">
        {pages && (
          <section className={`profile-card ${stat} ${half}`}>
            <CardHead icon="page">Pages</CardHead>
            <p className="profile-big">{num(totals.pages)}</p>
            <p className="profile-note">{pagesNote(totals.pages, person.joined, today)}</p>
          </section>
        )}
        {offerGoal && <GoalCard year={Number(today.slice(0, 4))} read={stats.finishedThisYear} goal={null} owner span={stat} today={today} />}
        {rating && (
          <section className={`profile-card ${stat} ${half}`}>
            <CardHead icon="star">Average rating</CardHead>
            <p className="profile-big">{totals.rating!.toFixed(1)}</p>
            <StarRating value={Math.round(totals.rating! * 2) / 2} size="md" />
            {stats.fiveStars > 0 && <p className="profile-note">{`${plural(stats.fiveStars, "five-star read")}.`}</p>}
          </section>
        )}
        {hasGoal && (
          <GoalCard
            year={Number(today.slice(0, 4))}
            read={stats.finishedThisYear}
            goal={goal}
            owner={self}
            span={firstRow ? "profile-card--2 profile-card--tall" : "profile-card--2"}
            today={today}
          />
        )}

        {!canRead && (
          <section className={`profile-card ${second}`}>
            <CardHead icon="lock">Reading</CardHead>
            <p className="profile-hidden-text">
              {profile.visibility === "friends" ? `${shown} shares their books and numbers with friends only.` : `${shown} keeps their books and numbers private.`}
            </p>
          </section>
        )}
        {reading && (
          <section className={`profile-card ${second}`}>
            <ReadingNow reading={stats.reading} />
          </section>
        )}
        {last && (
          <section className={`profile-card ${second}`}>
            <CardHead icon="open">Last finished</CardHead>
            <div className="profile-reading profile-reading--1">
              <div className="profile-now">
                <div className="profile-cover">
                  <BookCover book={last.book} />
                </div>
                <div className="profile-now-body">
                  <p className="profile-now-title">{last.book.title}</p>
                  <p className="profile-note profile-now-note">{`${last.book.author} · finished ${dayMonth(last.date)}`}</p>
                  {last.book.rating > 0 && <StarRating value={last.book.rating} size="sm" />}
                </div>
              </div>
            </div>
          </section>
        )}
        {firstBook && !last && (
          <section className={`profile-card profile-card--dashed ${second}`}>
            <CardHead icon="open">Your first book</CardHead>
            <p className="profile-note profile-prompt-text">Add a book to your library and it&rsquo;ll show up here.</p>
            <Link className="btn profile-prompt-button" href="/">
              Go to your library
            </Link>
          </section>
        )}
        <Achievements span={second} />

        {stats.best.length > 0 ? (
          <section className="profile-card profile-card--6">
            <CardHead icon="star">Highest rated</CardHead>
            <Covers books={stats.best} rated={profile.shareRatings} />
          </section>
        ) : (
          stats.recent.length > 0 && (
            <section className="profile-card profile-card--6">
              <CardHead icon="shelf">Recently finished</CardHead>
              <Covers books={stats.recent} rated={false} />
            </section>
          )
        )}

        {taste && taste.common.length > 0 && (
          <section className="profile-card profile-card--6">
            <div className="profile-card-head">
              <ProfileIcon name="taste" />
              <h2>You&rsquo;ve both read</h2>
              <span className="profile-more">{`About ${plural(taste.common.length, "book")}`}</span>
            </div>
            {/* Matching books across libraries is approximate, hence "about". */}
            {taste.match !== undefined && (
              <p className="profile-note profile-taste">
                <b>{`Taste match: ${taste.match}%`}</b>
                {` about, from ${plural(taste.rated, "book")} you’ve both rated.`}
              </p>
            )}
            <Covers books={taste.common.slice(0, COMMON_MAX)} rated={profile.shareRatings} />
          </section>
        )}

        {stats.shelves.length > 0 && (
          <section className="profile-card profile-card--4">
            <CardHead icon="shelf">What&rsquo;s on the shelves</CardHead>
            <div className="profile-shelf-bar" aria-hidden="true">
              {stats.shelves.map((g, i) => (
                <i key={g.genre} style={{ flex: g.books, background: SHELF_COLORS[i] }} title={`${g.genre}: ${g.books}`} />
              ))}
            </div>
            <ul className="profile-legend">
              {stats.shelves.map((g, i) => (
                <li key={g.genre}>
                  <i style={{ background: SHELF_COLORS[i] }} />
                  <span>{g.genre}</span>
                  <em>{num(g.books)}</em>
                </li>
              ))}
            </ul>
          </section>
        )}
        <FriendsCard
          span={stats.shelves.length > 0 ? "profile-card--2" : "profile-card--6"}
          href={friends.href}
          friends={friends.all}
          title={`${shown}’s friends`}
          own={self}
          news={friends.news ?? 0}
        />
      </div>
    </>
  );
}
