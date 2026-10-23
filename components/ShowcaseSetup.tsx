"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { includesReading, type ShowcaseInclude } from "@/lib/showcaseYear";
import Spinner from "./Spinner";

// Choosing what the reader's showcase shows: which year (each with a preview
// of how it would look), which books, and the name on it. Saving makes the
// showcase, or changes the one that's on and keeps its link.

interface Showcase {
  id: string;
  year: number;
  include: ShowcaseInclude;
  name: string | null;
}

const NAME_MAX = 40;

const CHOICES: { value: ShowcaseInclude; label: string }[] = [
  { value: "both", label: "Books I finished and what I’m reading now" },
  { value: "read", label: "Only books I finished" },
  { value: "reading", label: "Only what I’m reading now" },
];

// What a year can show: what's being read belongs to this year alone.
const allowed = (include: ShowcaseInclude, year: number, thisYear: number): ShowcaseInclude =>
  year === thisYear ? include : "read";

export function previewHref(year: number, include: ShowcaseInclude, name: string): string {
  return `/showcase/preview/${year}?${new URLSearchParams({ include, name })}`;
}

export function setupHref(year: number, include: ShowcaseInclude, name: string): string {
  return `/showcase/setup?${new URLSearchParams({ year: String(year), include, name })}`;
}

export default function ShowcaseSetup({
  years,
  live,
  initial,
}: {
  years: { year: number; books: number }[]; // newest first; the first is this year
  live: Showcase | null;
  initial: { year: number; include: ShowcaseInclude; name: string };
}) {
  const router = useRouter();
  const thisYear = years[0].year;
  const [year, setYear] = useState(initial.year);
  const [include, setInclude] = useState<ShowcaseInclude>(initial.include);
  const [name, setName] = useState(initial.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effective = allowed(include, year, thisYear);
  const unchanged =
    live && live.year === year && live.include === effective && (live.name ?? "") === name.trim().replace(/\s+/g, " ");

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, include: effective, name }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t save. Try again.");
      router.push("/showcase");
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
                {live?.year === y && <span className="badge setup-year-badge">On show</span>}
              </label>
              <Link className="setup-year-preview" href={previewHref(y, allowed(include, y, thisYear), name)}>
                Preview
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="setup-step">
        <legend className="setup-legend">
          <span className="setup-legend-num">2</span>Choose what&rsquo;s on it
        </legend>
        <div className="setup-choices">
          {CHOICES.map((c) => (
            <label key={c.value} className="checkline">
              <input
                type="radio"
                name="include"
                value={c.value}
                checked={effective === c.value}
                disabled={year !== thisYear && c.value !== "read"}
                onChange={() => setInclude(c.value)}
              />
              <span>{c.label}</span>
            </label>
          ))}
          {!includesReading("both", year, thisYear) && (
            <p className="setup-hint">Only {thisYear}&rsquo;s showcase can show what you&rsquo;re reading now.</p>
          )}
        </div>
      </fieldset>

      <fieldset className="setup-step">
        <legend className="setup-legend">
          <span className="setup-legend-num">3</span>Put your name on it
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
        <Link className="btn" href={previewHref(year, effective, name)}>
          Preview {year}
        </Link>
        <Link className="setup-cancel" href="/showcase">
          Cancel
        </Link>
      </div>
      {live && live.year !== year && (
        <p className="setup-hint">Your link stays the same: it&rsquo;ll show {year} instead of {live.year}.</p>
      )}
    </form>
  );
}
