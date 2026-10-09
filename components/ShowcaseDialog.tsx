"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { ShowcaseInclude } from "@/lib/showcaseYear";

// Makes, changes or turns off the public page of a year's reading (a
// showcase, lib/showcase.ts). One per year; its link stays the same.

interface Showcase {
  id: string;
  year: number;
  include: ShowcaseInclude;
  name: string | null;
}

const NAME_MAX = 40;

const CHOICES: { value: ShowcaseInclude; label: string }[] = [
  { value: "both", label: "Read and Reading" },
  { value: "read", label: "Read only" },
  { value: "reading", label: "Reading only" },
];

export default function ShowcaseDialog({ years, onClose }: { years: number[]; onClose: () => void }) {
  const thisYear = years[0];
  const { data: session } = authClient.useSession();
  const firstName = session?.user.name.trim().split(/\s+/)[0] ?? "";

  const [showcases, setShowcases] = useState<Showcase[] | null>(null);
  const [year, setYear] = useState(thisYear);
  const [include, setInclude] = useState<ShowcaseInclude>("both");
  const [name, setName] = useState<string | null>(null); // null until loaded or typed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const current = showcases?.find((s) => s.year === year) ?? null;
  const url = current ? `${window.location.origin}/s/${current.id}` : null;
  const pastYear = year !== thisYear;

  useEffect(() => {
    fetch("/api/showcases")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { showcases: Showcase[] }) => {
        setShowcases(d.showcases);
        // Open on this year's saved settings, if it has a showcase.
        const existing = d.showcases.find((s) => s.year === thisYear);
        if (existing) {
          setInclude(existing.include);
          setName(existing.name ?? "");
        }
      })
      .catch(() => setError("Your showcases couldn’t be loaded."));
  }, [thisYear]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Picking a year shows that year's settings, or fresh ones.
  const pick = (y: number) => {
    const existing = showcases?.find((s) => s.year === y);
    setYear(y);
    setInclude(existing?.include ?? (y === thisYear ? "both" : "read"));
    setName(existing ? (existing.name ?? "") : null);
    setError(null);
    setCopied(false);
  };

  const loaded = showcases !== null;
  const shownName = name ?? firstName;
  const effectiveInclude: ShowcaseInclude = pastYear ? "read" : include;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, include: effectiveInclude, name: shownName }),
      });
      const data: { showcase?: Showcase; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.showcase) throw new Error(data.error ?? "That didn’t save — try again.");
      const saved = data.showcase;
      setShowcases((list) => [...(list ?? []).filter((s) => s.year !== saved.year), saved]);
      setName(saved.name ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t save — try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/showcases/${current.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      setShowcases((list) => (list ?? []).filter((s) => s.id !== current.id));
      setCopied(false);
    } catch {
      setError("That didn’t work — try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Copying didn’t work — select the link and copy it.");
    }
  };

  const changed =
    current && (current.include !== effectiveInclude || (current.name ?? "") !== shownName.trim().replace(/\s+/g, " "));

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog dialog--form showcase-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="showcase-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 id="showcase-dialog-title" className="form-heading">
          Showcase your year
        </h2>
        <p className="showcase-dialog-lede">
          A page of your year in books for anyone you send the link to: covers, titles, authors, ratings and page
          counts, never your notes or words. It keeps up as you read.
        </p>

        <div className="showcase-dialog-fields">
          <label className="field">
            <span>Year</span>
            <select value={year} onChange={(e) => pick(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {showcases?.some((s) => s.year === y) ? `${y} · shared` : y}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="field showcase-dialog-include">
            <span>Books to show</span>
            {CHOICES.map((c) => (
              <label key={c.value} className="checkline">
                <input
                  type="radio"
                  name="showcase-include"
                  value={c.value}
                  checked={effectiveInclude === c.value}
                  disabled={pastYear && c.value !== "read"}
                  onChange={() => setInclude(c.value)}
                />
                <span>{c.label}</span>
              </label>
            ))}
            {pastYear && <p className="showcase-dialog-hint">Only this year’s page can show what you’re reading now.</p>}
          </fieldset>

          <label className="field">
            <span>Name on the page</span>
            <input
              type="text"
              value={shownName}
              maxLength={NAME_MAX}
              placeholder="No name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>

        {current && url && (
          <div className="showcase-dialog-link">
            <span className="showcase-dialog-link-label">Your link</span>
            <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Showcase link" />
            <div className="showcase-dialog-row">
              <button type="button" className="btn btn--primary" onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            </div>
          </div>
        )}

        {error && (
          <p className="settings-note settings-note--error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog-actions">
          {current ? (
            <>
              <button type="button" className="btn btn--primary" disabled={busy || !changed} onClick={save}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn btn--danger" disabled={busy} onClick={turnOff}>
                Turn off
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--accent" disabled={busy || !loaded} onClick={save}>
              {busy ? "Making it…" : "Make my link"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
