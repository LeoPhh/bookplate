"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Book, BookFormat, FORMAT_LABELS, isCustomSource, ProgressEntry, sourceLabel } from "@/lib/types";
import { fmtShortDate, plural, summarize } from "@/lib/progress";
import ProgressBar from "./ProgressBar";
import { paletteFor } from "@/lib/palette";
import StarRating from "./StarRating";

// Single-series magnitude charts: one hue (vermilion — about 3.6:1 on the
// white card surface), direct labels, no legend.
// Chart colours come from CSS custom properties defined in globals.css.
const SERIES = "var(--chart-series)";
const SERIES_HOVER = "var(--chart-series-hover)";
const GRID = "var(--chart-grid)";

interface Tip {
  left: number; // % of chart width
  top: number; // % of chart height
  text: string;
}

interface YearCount {
  year: number;
  count: number;
}

// What the user has drilled into, if anything.
type Drill =
  | { kind: "year"; year: number }
  | { kind: "genres" }
  | { kind: "genre"; genre: string }
  | { kind: "source"; source: string | null } // null = no source set
  | { kind: "rating"; rating: number };

function yearCounts(books: Book[]): YearCount[] {
  const map = new Map<number, number>();
  for (const b of books) {
    if (b.status !== "read" || !b.dateRead) continue;
    const y = Number(b.dateRead.slice(0, 4));
    map.set(y, (map.get(y) ?? 0) + 1);
  }
  if (map.size === 0) return [];
  const years = [...map.keys()];
  const min = Math.min(...years);
  const max = Math.max(...years, new Date().getFullYear());
  const out: YearCount[] = [];
  for (let y = min; y <= max; y++) out.push({ year: y, count: map.get(y) ?? 0 });
  return out;
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Column chart: books finished per year. Columns are clickable.
function YearChart({ data, onPick }: { data: YearCount[]; onPick: (year: number) => void }) {
  const [tip, setTip] = useState<Tip | null>(null);

  const W = 720;
  const H = 230;
  const pad = { left: 30, right: 10, top: 22, bottom: 26 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const step = maxCount <= 5 ? 1 : Math.ceil(maxCount / 4);
  const yMax = Math.ceil(maxCount / step) * step;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);

  const slot = plotW / data.length;
  const barW = Math.min(24, slot * 0.55);
  const yFor = (v: number) => pad.top + plotH * (1 - v / yMax);

  return (
    <div className="chart-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Books finished per year">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={yFor(t)} y2={yFor(t)} stroke={GRID} strokeWidth="1" />
            <text x={pad.left - 7} y={yFor(t) + 3.5} textAnchor="end" className="chart-tick">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + slot * i + (slot - barW) / 2;
          const y = yFor(d.count);
          const h = plotH - (y - pad.top);
          const r = Math.min(4, h, barW / 2);
          const cx = x + barW / 2;
          return (
            <g key={d.year}>
              {d.count > 0 && (
                <path
                  d={`M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`}
                  fill={tip?.text.startsWith(`${d.year}`) ? SERIES_HOVER : SERIES}
                />
              )}
              {d.count > 0 && (
                <text x={cx} y={y - 6} textAnchor="middle" className="chart-cap">
                  {d.count}
                </text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" className="chart-tick">
                {d.year}
              </text>
              {/* generous click/hover target for the whole column slot */}
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => onPick(d.year)}
                onMouseEnter={() =>
                  setTip({
                    left: (cx / W) * 100,
                    top: (Math.min(y, pad.top + plotH - 8) / H) * 100,
                    text: `${d.year} — ${d.count} ${d.count === 1 ? "book" : "books"}`,
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${tip.left}%`, top: `${tip.top}%` }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

interface BarRow {
  label: string;
  count: number;
  action?: () => void;
}

// Horizontal bar list used for ratings, genres, and sources. When `total`
// is given, each row also shows its share as a percentage. Rows with an
// `action` are clickable.
function BarList({
  rows,
  total,
  narrowLabels = false,
  maxWidthPct = 86,
}: {
  rows: BarRow[];
  total?: number;
  narrowLabels?: boolean; // for short labels like "5 ★"
  maxWidthPct?: number;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const rowClass = narrowLabels ? "hbar-row hbar-row--narrow" : "hbar-row";
  return (
    <div>
      {rows.map((r) => {
        const inner = (
          <>
            <span className="hbar-label">{r.label}</span>
            <span className="hbar-track">
              {r.count > 0 && <span className="hbar-fill" style={{ width: `${(r.count / max) * maxWidthPct}%` }} />}
              <span className="hbar-count">
                {r.count}
                {total && r.count > 0 ? ` · ${Math.round((r.count / total) * 100)}%` : ""}
              </span>
            </span>
          </>
        );
        return r.action ? (
          <button
            key={r.label}
            type="button"
            className={`${rowClass} hbar-row--click`}
            title={`${r.label}: ${r.count}`}
            onClick={r.action}
          >
            {inner}
          </button>
        ) : (
          <div key={r.label} className={rowClass} title={`${r.label}: ${r.count}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// A clickable book row inside a drill-down dialog.
function DrillBookRow({ book, onSelect }: { book: Book; onSelect: (id: string) => void }) {
  const c = paletteFor(book.colorIndex);
  return (
    <li>
      <button type="button" className="drill-book" onClick={() => onSelect(book.id)}>
        <span className="drill-thumb" style={{ background: c.bg }}>
          {book.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverImage} alt="" loading="lazy" />
          )}
        </span>
        <span className="drill-book-text">
          <span className="drill-book-title">{book.title}</span>
          <span className="drill-book-meta">{book.author}</span>
        </span>
        <span className="drill-book-right">
          {book.rating > 0 && <StarRating value={book.rating} size="sm" />}
          {book.dateRead && <span className="drill-book-date">{fmtDate(book.dateRead)}</span>}
        </span>
      </button>
    </li>
  );
}

function DrillDialog({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // A book detail / form dialog stacked on top owns the Escape key.
      if (document.querySelector(".dialog--detail, .dialog--form")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog dialog--drill" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="drill-title">{title}</h2>
        {sub && <p className="drill-sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

interface Props {
  books: Book[];
  progress: ProgressEntry[];
  onSelect: (id: string) => void;
}

// Books being read, with how far along each one is.
function CurrentlyReading({
  books,
  progress,
  onSelect,
}: {
  books: Book[];
  progress: ProgressEntry[];
  onSelect: (id: string) => void;
}) {
  const reading = books
    .filter((b) => b.status === "reading")
    .map((b) => ({ book: b, s: summarize(b, progress) }))
    .sort((a, b) => (b.s?.percent ?? -1) - (a.s?.percent ?? -1));
  const tracked = books
    .filter((b) => b.status === "read")
    .map((b) => summarize(b, progress)?.readInDays)
    .filter((d): d is number => d !== undefined);
  if (reading.length === 0 && tracked.length === 0) return null;
  const avg = tracked.length ? Math.round(tracked.reduce((a, b) => a + b, 0) / tracked.length) : null;

  return (
    <div className="chart-card">
      <h2 className="chart-title">Currently reading</h2>
      <p className="chart-sub">Click a book to update where you are</p>
      {reading.length > 0 ? (
        <ul className="reading-list">
          {reading.map(({ book, s }) => (
            <li key={book.id}>
              <button type="button" className="reading-row" onClick={() => onSelect(book.id)}>
                <span className="reading-title">
                  {book.title}
                  <span className="reading-author">{book.author}</span>
                </span>
                <ProgressBar percent={s?.percent ?? 0} />
                <span className="reading-percent">{s ? `${s.percent}%` : "—"}</span>
                <span className="reading-meta">
                  {!s
                    ? "No progress logged yet"
                    : s.percent >= 100
                      ? "On the last page"
                      : s.daysLeft !== undefined
                        ? `About ${plural(s.daysLeft, "day")} left`
                        : `Started ${fmtShortDate(s.started)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">Nothing on the go — mark a book as Reading to track it here.</p>
      )}
      {avg !== null && (
        <p className="reading-footnote">
          Books you tracked took {plural(avg, "day")} on average to finish ({plural(tracked.length, "book")}).
        </p>
      )}
    </div>
  );
}

export default function StatsView({ books, progress, onSelect }: Props) {
  const [drill, setDrill] = useState<Drill | null>(null);

  const stats = useMemo(() => {
    const read = books.filter((b) => b.status === "read");
    const thisYear = new Date().getFullYear();
    const readThisYear = read.filter((b) => b.dateRead?.startsWith(String(thisYear))).length;
    const pages = read.reduce((s, b) => s + (b.pages ?? 0), 0);
    const rated = books.filter((b) => b.rating > 0);
    const avg = rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : null;

    const ratings = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((n) => ({
      rating: n,
      label: `${n} ★`,
      count: books.filter((b) => b.rating === n).length,
    }));

    const genreMap = new Map<string, number>();
    for (const b of books) {
      const g = b.genre?.trim() || "Unspecified";
      genreMap.set(g, (genreMap.get(g) ?? 0) + 1);
    }
    const allGenres = [...genreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
    const genres = allGenres.slice(0, 6);
    const rest = allGenres.slice(6).reduce((s, g) => s + g.count, 0);
    if (rest > 0) genres.push({ label: "Other", count: rest });

    const custom = new Map<string, number>();
    for (const b of books) {
      if (isCustomSource(b.format)) custom.set(b.format, (custom.get(b.format) ?? 0) + 1);
    }
    const sources: { source: string | null; label: string; count: number }[] = [
      ...(Object.keys(FORMAT_LABELS) as BookFormat[]).map((f) => ({
        source: f as string | null,
        label: FORMAT_LABELS[f],
        count: books.filter((b) => b.format === f).length,
      })),
      ...[...custom.entries()].map(([source, count]) => ({ source: source as string | null, label: source, count })),
    ].sort((a, b) => b.count - a.count);
    const unsourced = books.filter((b) => !b.format).length;
    if (unsourced > 0) sources.push({ source: null, label: "Unspecified", count: unsourced });

    return { read, readThisYear, pages, avg, ratings, genres, allGenres, sources, years: yearCounts(books) };
  }, [books]);

  const byRatingThenTitle = (a: Book, b: Book) => b.rating - a.rating || a.title.localeCompare(b.title);

  const renderBookList = (list: Book[]) =>
    list.length > 0 ? (
      <ul className="drill-list">
        {list.map((b) => (
          <DrillBookRow key={b.id} book={b} onSelect={onSelect} />
        ))}
      </ul>
    ) : (
      <p className="empty-note">Nothing here yet.</p>
    );

  const renderDrill = () => {
    if (!drill) return null;

    if (drill.kind === "year") {
      const list = books
        .filter((b) => b.status === "read" && b.dateRead?.startsWith(String(drill.year)))
        .sort((a, b) => (a.dateRead ?? "").localeCompare(b.dateRead ?? ""));
      const pages = list.reduce((s, b) => s + (b.pages ?? 0), 0);
      const rated = list.filter((b) => b.rating > 0);
      const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : "—";
      const maxRating = Math.max(...list.map((b) => b.rating), 0);
      const best = maxRating > 0 ? list.filter((b) => b.rating === maxRating) : [];
      const showBest = best.length > 0 && best.length < list.length;
      return (
        <DrillDialog
          title={`Read in ${drill.year}`}
          sub={`${list.length} ${list.length === 1 ? "book" : "books"} finished`}
          onClose={() => setDrill(null)}
        >
          <div className="drill-tiles">
            <div className="drill-tile">
              <b>{list.length}</b>
              books
            </div>
            <div className="drill-tile">
              <b>{pages.toLocaleString()}</b>
              pages
            </div>
            <div className="drill-tile">
              <b>{avg}</b>
              average ★
            </div>
          </div>
          {showBest && (
            <>
              <h3 className="drill-section-title">Highest rated ({maxRating} ★)</h3>
              <div className="drill-best">{renderBookList(best)}</div>
            </>
          )}
          <h3 className="drill-section-title">In reading order</h3>
          {renderBookList(list)}
        </DrillDialog>
      );
    }

    if (drill.kind === "genres") {
      const rows = stats.allGenres.map((g) => ({
        ...g,
        action: () => setDrill({ kind: "genre", genre: g.label }),
      }));
      return (
        <DrillDialog
          title="All genres"
          sub={`${stats.allGenres.length} genres across ${books.length} books — click one for its books`}
          onClose={() => setDrill(null)}
        >
          <BarList rows={rows} total={books.length} />
        </DrillDialog>
      );
    }

    if (drill.kind === "genre") {
      const list = books.filter((b) => (b.genre?.trim() || "Unspecified") === drill.genre).sort(byRatingThenTitle);
      return (
        <DrillDialog
          title={drill.genre}
          sub={`${list.length} ${list.length === 1 ? "book" : "books"}, best first`}
          onClose={() => setDrill(null)}
        >
          <button type="button" className="drill-back" onClick={() => setDrill({ kind: "genres" })}>
            ‹ All genres
          </button>
          {renderBookList(list)}
        </DrillDialog>
      );
    }

    if (drill.kind === "source") {
      const list = books
        .filter((b) => (drill.source === null ? !b.format : b.format === drill.source))
        .sort(byRatingThenTitle);
      const label = drill.source === null ? "Unspecified source" : sourceLabel(drill.source)!;
      return (
        <DrillDialog
          title={label}
          sub={`${list.length} ${list.length === 1 ? "book" : "books"}, best first`}
          onClose={() => setDrill(null)}
        >
          {renderBookList(list)}
        </DrillDialog>
      );
    }

    // rating
    const list = books.filter((b) => b.rating === drill.rating).sort((a, b) => a.title.localeCompare(b.title));
    return (
      <DrillDialog
        title={`Rated ${drill.rating} ★`}
        sub={`${list.length} ${list.length === 1 ? "book" : "books"}`}
        onClose={() => setDrill(null)}
      >
        {renderBookList(list)}
      </DrillDialog>
    );
  };

  const ratingRows = stats.ratings.map((r) => ({
    label: r.label,
    count: r.count,
    action: () => setDrill({ kind: "rating", rating: r.rating }),
  }));
  const genreRows = stats.genres.map((g) => ({
    label: g.label,
    count: g.count,
    action: () => setDrill(g.label === "Other" ? { kind: "genres" } : { kind: "genre", genre: g.label }),
  }));
  const sourceRows = stats.sources.map((s) => ({
    label: s.label,
    count: s.count,
    action: () => setDrill({ kind: "source", source: s.source }),
  }));

  return (
    <div className="stats">
      <div className="stat-tiles">
        <div className="stat-tile">
          <p className="stat-tile-label">Books read</p>
          <p className="stat-tile-value">{stats.read.length}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-tile-label">Read in {new Date().getFullYear()}</p>
          <p className="stat-tile-value">{stats.readThisYear}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-tile-label">Pages read</p>
          <p className="stat-tile-value">{stats.pages.toLocaleString()}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-tile-label">Average rating</p>
          <p className="stat-tile-value">{stats.avg ? stats.avg.toFixed(1) : "—"}</p>
        </div>
      </div>

      <CurrentlyReading books={books} progress={progress} onSelect={onSelect} />

      <div className="chart-card">
        <h2 className="chart-title">Books finished by year</h2>
        <p className="chart-sub">Grouped by year — click a column for that year’s books</p>
        {stats.years.length > 0 ? (
          <YearChart data={stats.years} onPick={(year) => setDrill({ kind: "year", year })} />
        ) : (
          <p className="empty-note">Finish a book (with a date) and the chart will appear.</p>
        )}
      </div>

      <div className="stats-row">
        <div className="chart-card">
          <h2 className="chart-title">Ratings given</h2>
          <p className="chart-sub">Click a row to see those books</p>
          <BarList rows={ratingRows} narrowLabels />
        </div>
        <div className="chart-card">
          <h2 className="chart-title">Genres on the shelf</h2>
          <p className="chart-sub">Most common first — click one for its books</p>
          <BarList rows={genreRows} />
          {stats.allGenres.length > 6 && (
            <button type="button" className="drill-back chart-more" onClick={() => setDrill({ kind: "genres" })}>
              See all {stats.allGenres.length} genres ›
            </button>
          )}
        </div>
        <div className="chart-card">
          <h2 className="chart-title">Where they came from</h2>
          <p className="chart-sub">Share of the library by source</p>
          <BarList rows={sourceRows} total={books.length} />
        </div>
      </div>

      {renderDrill()}
    </div>
  );
}
