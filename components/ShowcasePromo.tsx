"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import BookCover from "./BookCover";
import { MONTHS, possessive, type ShowcaseYear } from "@/lib/showcaseYear";

// The Showcase tab before a reader has one on: a moving demo of their own
// best year as a showcase (or a sample shelf when they haven't enough books
// yet), how setting one up goes, and the way in. Everything plays once it
// scrolls into view, and stands still for readers who ask for less motion.

const SHELF_PER_MONTH = 3;
const STAGE_LOOP_MS = 14_000;

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

// Steps through 0…n-1 every `ms` while `run`, for the looping step demos.
function useCycle(n: number, ms: number, run: boolean): number {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!run || reduced || n < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(id);
  }, [n, ms, run, reduced]);
  return i;
}

// The demo showcase in a browser window, replaying every so often while on
// screen.
function Stage({ name, view, host }: { name: string; view: ShowcaseYear; host: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!seen || reduced) return;
    const id = setInterval(() => setRound((r) => r + 1), STAGE_LOOP_MS);
    return () => clearInterval(id);
  }, [seen, reduced]);

  const { stats } = view;
  // Each month's first few covers, numbered across the year so they drop in
  // one after another.
  const firsts = view.months.map((books) => books.slice(0, SHELF_PER_MONTH));
  const offsets = firsts.map((_, m) => firsts.slice(0, m).reduce((n, books) => n + books.length, 0));
  return (
    <div ref={ref} className={seen ? "promo-stage promo-stage--on" : "promo-stage"} aria-hidden="true">
      <div key={round} className="promo-window">
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
                <CountUp key={round} to={stats.books} run={seen} delay={900} />
              </p>
            </div>
            <div className="promo-stat">
              <p className="promo-stat-label">Pages</p>
              <p className="promo-stat-value">
                <CountUp key={round} to={stats.pages} run={seen} delay={1050} />
              </p>
            </div>
            <div className="promo-stat">
              <p className="promo-stat-label">{stats.rating !== undefined ? "Avg rating" : "A day"}</p>
              <p className="promo-stat-value">
                {stats.rating !== undefined ? (
                  <CountUp key={round} to={stats.rating} run={seen} decimals={1} delay={1200} />
                ) : (
                  <CountUp key={round} to={stats.pagesPerDay ?? 0} run={seen} delay={1200} />
                )}
              </p>
            </div>
          </div>

          <ol className="promo-shelf">
            {view.months.map((books, m) => (
              <li key={MONTHS[m]} className="promo-month">
                <span className="promo-month-name">{MONTHS[m].slice(0, 1)}</span>
                {firsts[m].map((b, i) => (
                  <div key={b.id} className="promo-cover" style={{ "--i": offsets[m] + i } as CSSProperties}>
                    <BookCover book={b} />
                  </div>
                ))}
                {books.length > SHELF_PER_MONTH && <span className="promo-month-more">+{books.length - SHELF_PER_MONTH}</span>}
              </li>
            ))}
          </ol>

          {view.favourites.length > 0 && (
            <div className="promo-stars">
              <span className="promo-stars-label">Five stars</span>
              <div className="promo-stars-row">
                {view.favourites.slice(0, 5).map((b, i) => (
                  <div key={b.id} className="promo-cover promo-cover--star" style={{ "--i": i } as CSSProperties}>
                    <BookCover book={b} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepYears({ years, run }: { years: number[]; run: boolean }) {
  const active = useCycle(years.length, 1500, run);
  return (
    <div className="promo-demo promo-years" aria-hidden="true">
      {years.map((y, i) => (
        <span key={y} className={i === active ? "promo-chip promo-chip--on" : "promo-chip"}>
          {y}
        </span>
      ))}
    </div>
  );
}

function StepChoices({ name, run }: { name: string; run: boolean }) {
  const phase = useCycle(3, 1800, run);
  const shown = name || "Your name";
  return (
    <div className="promo-demo promo-choices" aria-hidden="true">
      <span className="promo-toggle promo-toggle--on">
        <i />
        Books I finished
      </span>
      <span className={phase !== 1 ? "promo-toggle promo-toggle--on" : "promo-toggle"}>
        <i />
        What I&rsquo;m reading now
      </span>
      <span className="promo-name">
        <span className="promo-name-text" style={{ "--chars": [...shown].length } as CSSProperties} key={phase === 0 ? "a" : "b"}>
          {shown}
        </span>
      </span>
    </div>
  );
}

function StepLink({ host, run }: { host: string; run: boolean }) {
  const phase = useCycle(2, 2200, run);
  return (
    <div className="promo-demo promo-link" aria-hidden="true">
      <span className="promo-link-url">{host}/s/rB7kXq2m…</span>
      <span className={phase === 1 ? "promo-link-btn promo-link-btn--done" : "promo-link-btn"}>
        {phase === 1 ? "Copied ✓" : "Copy link"}
      </span>
    </div>
  );
}

export default function ShowcasePromo({
  name,
  view,
  sample,
  years,
  host,
}: {
  name: string; // the reader's first name
  view: ShowcaseYear; // the year the demo shows
  sample: boolean; // whether that's the made-up sample shelf
  years: number[]; // the years they could showcase, newest first
  host: string; // this server's address, for the demo link
}) {
  const [stepsRef, stepsSeen] = useInView<HTMLOListElement>();
  // Their own years when there's a choice; a new reader sees what it'll be like.
  const chips = years.length >= 2 ? years.slice(0, 4) : [years[0], years[0] - 1, years[0] - 2];

  return (
    <div className="promo">
      <section className="promo-hero">
        <div className="promo-copy">
          <p className="promo-eyebrow">Showcase</p>
          <h1 className="promo-title">
            Your year in books, <em>on show.</em>
          </h1>
          <p className="promo-lede">
            One link that shows off a whole year of reading: every cover under the month you finished it, your numbers,
            your five-star reads. Send it to a friend, drop it in the group chat, put it in your bio.
          </p>
          <div className="promo-actions">
            <Link href="/showcase/setup" className="btn btn--accent promo-cta">
              Showcase your library
            </Link>
          </div>
          <p className="promo-fine">Free, private until you share it, and off again in one click.</p>
        </div>
        <figure className="promo-figure">
          <Stage name={name} view={view} host={host} />
          <figcaption className="promo-caption">
            {sample
              ? "A sample shelf. Yours fills in as you finish books."
              : `Your ${view.year}, the way your friends would see it.`}
          </figcaption>
        </figure>
      </section>

      <section className="promo-how">
        <h2 className="promo-heading">Three steps, about a minute.</h2>
        <ol ref={stepsRef} className={stepsSeen ? "promo-steps promo-steps--on" : "promo-steps"}>
          <li className="promo-step" style={{ "--i": 0 } as CSSProperties}>
            <span className="promo-step-num">1</span>
            <h3 className="promo-step-title">Pick a year</h3>
            <StepYears years={chips} run={stepsSeen} />
            <p className="promo-step-text">
              This year so far, or any year you&rsquo;ve finished books in. Preview each one first, and switch whenever you
              like: your link stays the same.
            </p>
          </li>
          <li className="promo-step" style={{ "--i": 1 } as CSSProperties}>
            <span className="promo-step-num">2</span>
            <h3 className="promo-step-title">Make it yours</h3>
            <StepChoices name={name} run={stepsSeen} />
            <p className="promo-step-text">
              Show the books you finished, what&rsquo;s on your nightstand, or both, under your name or none at all.
            </p>
          </li>
          <li className="promo-step" style={{ "--i": 2 } as CSSProperties}>
            <span className="promo-step-num">3</span>
            <h3 className="promo-step-title">Send the link</h3>
            <StepLink host={host} run={stepsSeen} />
            <p className="promo-step-text">
              It keeps up as you read. Covers, numbers and ratings only: never your notes, your words or your email.
            </p>
          </li>
        </ol>
      </section>

      <section className="promo-close">
        <p className="promo-close-title">Your shelf deserves an audience.</p>
        <Link href="/showcase/setup" className="btn btn--accent promo-cta">
          Showcase your library
        </Link>
      </section>
    </div>
  );
}
