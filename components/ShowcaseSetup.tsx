"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "./Spinner";

// Choosing what the reader's showcase shows, at the foot of the Showcase tab:
// which year and the name on it.
// Saving makes the showcase, or changes the one that's on and keeps its link.

interface Showcase {
  id: string;
  year: number;
  name: string | null;
}

const NAME_MAX = 40;

export default function ShowcaseSetup({
  years,
  live,
  initial,
}: {
  years: { year: number; books: number }[]; // newest first; the first is this year
  live: Showcase | null;
  initial: { year: number; name: string };
}) {
  const router = useRouter();
  const thisYear = years[0].year;
  const [year, setYear] = useState(initial.year);
  const [name, setName] = useState(initial.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchanged = live && live.year === year && (live.name ?? "") === name.trim().replace(/\s+/g, " ");

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, name }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t save. Try again.");
      // The tab turns into the one for a showcase that's on.
      router.replace("/showcase");
      router.refresh();
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t save. Try again.");
      setBusy(false);
    }
  };

  const label = !live ? `Showcase ${year}` : live.year !== year ? `Switch to ${year}` : "Save changes";

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset className="setup-step">
        <legend className="setup-legend">
          <span className="setup-legend-num">1</span>Pick a year
        </legend>
        <ul className="setup-years">
          {years.map(({ year: y, books }) => (
            <li key={y} className={y === year ? "setup-year setup-year--chosen" : "setup-year"}>
              <label className="setup-year-pick">
                <input type="radio" name="year" value={y} checked={y === year} onChange={() => setYear(y)} />
                <span className="setup-year-num">{y}</span>
                <span className="setup-year-count">
                  {books === 0 ? "No books finished yet" : `${books} ${books === 1 ? "book" : "books"}`}
                  {y === thisYear && books > 0 ? " so far" : ""}
                </span>
                {live?.year === y && <span className="badge setup-year-badge">On display</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="setup-step">
        <legend className="setup-legend">
          <span className="setup-legend-num">2</span>Put your name on it
        </legend>
        <label className="field setup-name">
          <span>Name on the page</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX}
            placeholder="No name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </fieldset>

      {error && (
        <p className="settings-note settings-note--error" role="alert">
          {error}
        </p>
      )}

      <div className="setup-actions">
        <button type="submit" className="btn btn--accent setup-save" disabled={busy || Boolean(unchanged)}>
          {busy ? <><Spinner />Saving…</> : label}
        </button>
      </div>
      {live && live.year !== year && (
        <p className="setup-hint">Your link stays the same: it&rsquo;ll show {year} instead of {live.year}.</p>
      )}
    </form>
  );
}
