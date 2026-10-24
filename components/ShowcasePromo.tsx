"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import BookCover from "./BookCover";
import { possessive, type ShowcaseYear } from "@/lib/showcaseYear";

// The Showcase tab before a reader has one on: a moving demo of their own
// best year as a showcase (or a sample shelf when they haven't enough books
// yet), how setting one up goes, and (passed in) the year picker. The demo
// plays once when it scrolls into view, and stands still for readers who ask
// for less motion.

const SHELF_MAX = 24; // about two rows of covers in the demo

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return reduced;
}

// True once the element has scrolled into view (and stays true).
function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

// Counts from 0 up to `to` once `run` turns true.
function CountUp({ to, run, decimals = 0, delay = 0 }: { to: number; run: boolean; decimals?: number; delay?: number }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run || reduced) return;
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1400));
      setValue(to * (1 - Math.pow(1 - t, 3))); // ease out
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, run, reduced, delay]);
  const shown = run && reduced ? to : value;
  return <>{decimals ? shown.toFixed(decimals) : Math.round(shown).toLocaleString("en-GB")}</>;
}

// The demo showcase in a browser window. It builds itself once, the first
// time it scrolls into view, and then stays put.
function Stage({ name, view, host }: { name: string; view: ShowcaseYear; host: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();

  const { stats } = view;
  const longest = view.read.find((b) => b.id === stats.longest?.id);
  return (
    <div ref={ref} className={seen ? "promo-stage promo-stage--on" : "promo-stage"} aria-hidden="true">
      <div className="promo-window">
        <div className="promo-window-bar">
          <span className="promo-window-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="promo-address">
            <span className="promo-address-host">{host}</span>
            <span className="promo-address-path">/s/rB7kXq2mPa9LtW4e</span>
          </span>
        </div>
        <div className="promo-window-body">
          <div className="promo-plate">
            <p className="promo-plate-eyebrow">Ex libris</p>
            <p className="promo-plate-name">{name ? `${possessive(name)} Library` : view.year}</p>
            <p className="promo-plate-edition">{name ? `The ${view.year} edition` : "A year in books"}</p>
          </div>

          <div className="promo-stats">
            <div className="promo-stat">
              <p className="promo-stat-label">Books</p>
              <p className="promo-stat-value">
                <CountUp to={stats.books} run={seen} delay={900} />
              </p>
            </div>
            <div className="promo-stat">
              <p className="promo-stat-label">Pages</p>
              <p className="promo-stat-value">
                <CountUp to={stats.pages} run={seen} delay={1050} />
              </p>
            </div>
            <div className="promo-stat">
              <p className="promo-stat-label">{stats.rating !== undefined ? "Avg rating" : "A day"}</p>
              <p className="promo-stat-value">
                {stats.rating !== undefined ? (
                  <CountUp to={stats.rating} run={seen} decimals={1} delay={1200} />
                ) : (
                  <CountUp to={stats.pagesPerDay ?? 0} run={seen} delay={1200} />
                )}
              </p>
            </div>
          </div>

          {/* Covers drop in one after another. */}
          <ol className="promo-shelf">
            {view.read.slice(0, SHELF_MAX).map((b, i) => (
              <li key={b.id} className="promo-cover" style={{ "--i": i } as CSSProperties}>
                <BookCover book={b} />
              </li>
            ))}
          </ol>

          {view.topRated.length > 0 && (
            <div className="promo-stars">
              <span className="promo-stars-label">Highest rated</span>
              <div className="promo-stars-row">
                {view.topRated.slice(0, 4).map((b, i) => (
                  <div key={b.id} className="promo-cover promo-cover--star" style={{ "--i": i } as CSSProperties}>
                    <BookCover book={b} />
                  </div>
                ))}
              </div>
              {longest && (
                <>
                  <span className="promo-stars-label">Longest read</span>
                  <div className="promo-cover promo-cover--star promo-cover--longest" style={{ "--i": 4 } as CSSProperties}>
                    <BookCover book={longest} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// A small copy of the year picker at the foot of the page, newest year chosen.
function StepYears({ years, thisYear }: { years: { year: number; books: number }[]; thisYear: number }) {
  return (
    <div className="promo-demo promo-years" aria-hidden="true">
      {years.map(({ year, books }, i) => (
        <span key={year} className={i === 0 ? "setup-year setup-year--chosen" : "setup-year"}>
          <span className="setup-year-pick">
            <i className={i === 0 ? "promo-radio promo-radio--on" : "promo-radio"} />
            <span className="setup-year-num">{year}</span>
            <span className="setup-year-count">
              {books === 0 ? "No books yet" : `${books} ${books === 1 ? "book" : "books"}`}
              {year === thisYear && books > 0 ? " so far" : ""}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

function StepChoices({ name }: { name: string }) {
  return (
    <div className="promo-demo promo-choices" aria-hidden="true">
      <span className="promo-name-label">Name on the page</span>
      <span className="promo-name">{name || "Your name"}</span>
    </div>
  );
}

function StepLink({ host }: { host: string }) {
  return (
    <div className="promo-demo promo-link" aria-hidden="true">
      <span className="promo-link-url">{host}/s/rB7kXq2m…</span>
      <span className="promo-link-btn">Copy link</span>
    </div>
  );
}

export default function ShowcasePromo({
  name,
  view,
  sample,
  years,
  host,
  children,
}: {
  name: string; // the reader's first name
  view: ShowcaseYear; // the year the demo shows
  sample: boolean; // whether that's the made-up sample shelf
  years: { year: number; books: number }[]; // the years they could showcase, newest first
  host: string; // this server's address, for the demo link
  children: ReactNode; // the year picker, at the foot
}) {
  // Their own years when there's a choice; a new reader gets last year from
  // the sample shelf (fifteen books) to see what choosing is like.
  const thisYear = years[0].year;
  const rows = years.length >= 2 ? years.slice(0, 2) : [years[0], { year: thisYear - 1, books: 15 }];

  return (
    <div className="promo">
      <section className="promo-hero">
        <div className="promo-copy">
          <p className="promo-eyebrow">Showcase</p>
          <h1 className="promo-title">
            Your year in books, <em>on display</em>
          </h1>
          <p className="promo-lede">
            One link that shows off a whole year of reading: every book you finished, your numbers, your highest-rated
            reads. Send it to a friend, drop it in the group chat, put it in your bio.
          </p>
        </div>
        <figure className="promo-figure">
          <Stage name={name} view={view} host={host} />
          {!sample && <figcaption className="promo-caption">{`Your ${view.year}, the way your friends would see it.`}</figcaption>}
        </figure>
      </section>

      <section className="promo-how">
        <h2 className="promo-heading">Three steps, about a minute</h2>
        <ol className="promo-steps">
          <li className="promo-step">
            <span className="promo-step-num">1</span>
            <h3 className="promo-step-title">Pick a year</h3>
            <StepYears years={rows} thisYear={thisYear} />
            <p className="promo-step-text">
              This year so far, or any year you&rsquo;ve finished books in. Switch whenever you
              like: your link stays the same.
            </p>
          </li>
          <li className="promo-step">
            <span className="promo-step-num">2</span>
            <h3 className="promo-step-title">Make it yours</h3>
            <StepChoices name={name} />
            <p className="promo-step-text">
              Put your name on the page, or leave it off. Your notes, words and what you&rsquo;re reading now stay
              private.
            </p>
          </li>
          <li className="promo-step">
            <span className="promo-step-num">3</span>
            <h3 className="promo-step-title">Send the link</h3>
            <StepLink host={host} />
            <p className="promo-step-text">
              It keeps up as you read. Covers, numbers and ratings only: never your notes, your words or your email.
            </p>
          </li>
        </ol>
      </section>
      {children}
    </div>
  );
}
