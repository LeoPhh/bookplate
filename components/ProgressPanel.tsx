"use client";

import { useState } from "react";
import { Book, ProgressEntry } from "@/lib/types";
import { entryPercent, fmtShortDate, plural, progressUnit, summarize, todayIso } from "@/lib/progress";
import ProgressBar from "./ProgressBar";

interface Props {
  book: Book;
  progress: ProgressEntry[];
  onLog: (entry: ProgressEntry) => void;
  onRemove: (date: string) => void;
  onFinish: () => void;
}

// The progress section of a Reading book's detail dialog: log where you are,
// see how it's going, and undo a mistaken update.
export default function ProgressPanel({ book, progress, onLog, onRemove, onFinish }: Props) {
  const unit = progressUnit(book);
  const s = summarize(book, progress);
  const [value, setValue] = useState(s ? String(unit === "page" ? s.page : s.percent) : "");
  const [error, setError] = useState<string | null>(null);
  const max = unit === "page" ? book.pages! : 100;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n) || n < 0 || n > max) {
      setError(unit === "page" ? `Enter a page from 0 to ${max}.` : "Enter a percentage from 0 to 100.");
      return;
    }
    setError(null);
    onLog(
      unit === "page"
        ? { bookId: book.id, date: todayIso(), page: Math.round(n), percent: (Math.round(n) / max) * 100 }
        : { bookId: book.id, date: todayIso(), percent: Math.round(n * 10) / 10 }
    );
  };

  const percent = s?.percent ?? 0;
  const unitWord = unit === "page" ? "page" : "%";

  return (
    <section className="progress-panel" aria-label="Reading progress">
      <p className="progress-label">Progress</p>
      <form className="progress-form" onSubmit={submit}>
        <label className="progress-input">
          {unit === "page" && <span>Page</span>}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            step={unit === "page" ? 1 : 0.1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={unit === "page" ? "Current page" : "Percentage read"}
          />
          <span>{unit === "page" ? `of ${max}` : "%"}</span>
        </label>
        <button type="submit" className="btn btn--primary">
          Update
        </button>
      </form>
      <div className="progress-track">
        <ProgressBar percent={percent} />
        <span className="progress-percent">{percent}%</span>
      </div>
      {error && <p className="progress-error">{error}</p>}

      {s ? (
        <>
          <p className="progress-meta">
            Started {fmtShortDate(s.started)} ·{" "}
            {s.daysReading === 0 ? "today" : `reading for ${plural(s.daysReading, "day")}`}
          </p>
          <p className="progress-meta">
            {s.percent >= 100
              ? "That’s the last page."
              : s.daysLeft !== undefined && s.perDay !== undefined
                ? `About ${plural(s.daysLeft, "day")} left at your pace (${
                    unit === "page" ? plural(Math.round(s.perDay), "page") : `${Math.round(s.perDay * 10) / 10}%`
                  } a day)`
                : "Update again on another day to see your pace."}
          </p>
          {s.percent >= 100 && (
            <button type="button" className="btn btn--primary progress-finish" onClick={onFinish}>
              Mark as finished
            </button>
          )}
          <ul className="progress-log" aria-label="Recent updates">
            {[...s.entries]
              .reverse()
              .slice(0, 4)
              .map((e) => (
                <li key={e.date}>
                  <span className="progress-log-date">{fmtShortDate(e.date)}</span>
                  <span>
                    {unit === "page" && e.page != null ? `${unitWord} ${e.page}` : `${Math.round(entryPercent(book, e))}%`}
                  </span>
                  <button
                    type="button"
                    className="progress-log-remove"
                    onClick={() => onRemove(e.date)}
                    aria-label={`Remove the update from ${fmtShortDate(e.date)}`}
                    title="Remove this update"
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <p className="progress-meta">
          {unit === "page"
            ? "Log the page you’re on to start tracking."
            : "This book has no page count, so progress is a percentage — or add the page count to track pages."}
        </p>
      )}
    </section>
  );
}
