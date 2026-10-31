"use client";

import { useState } from "react";
import type { Profile, Visibility } from "@/lib/social/profile";
import Spinner from "./Spinner";

// Settings → Profile → Profile page: the username (a handle in the code), a line
// about yourself, this year's reading goal, and whether the profile's private.

const HANDLE_MAX = 24;
const BIO_MAX = 160;
const GOAL_MAX = 500;

const VISIBILITY: { id: Visibility; label: string; text: string }[] = [
  {
    id: "private",
    label: "Private",
    text: "Only your friends can see your whole profile. Everyone else sees your name, photo, username, bio and bookplate, and how many books you’ve read and friends you have, but nothing else.",
  },
  {
    id: "public",
    label: "Public",
    text: "Anyone can see your whole profile, signed in or not. Search engines aren’t told about it.",
  },
];

export default function ProfileForm({ initial, goal }: { initial: Profile; goal: { year: number; books: number | null } }) {
  const [saved, setSaved] = useState(initial);
  const [savedGoal, setSavedGoal] = useState(goal.books);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [books, setBooks] = useState(goal.books === null ? "" : String(goal.books));
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const saveGoal = async () => {
    const wanted = books.trim() === "" ? null : Number(books);
    if (wanted === savedGoal) return;
    const res = await fetch(
      "/api/goal",
      wanted === null
        ? { method: "DELETE" }
        : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ books: wanted }) }
    );
    const data: { error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Your goal could not be saved.");
    setSavedGoal(wanted);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, bio, visibility }),
      });
      const data: { profile?: Profile; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) throw new Error(data.error ?? "Your profile could not be saved.");
      setSaved(data.profile);
      setHandle(data.profile.handle);
      await saveGoal();
      setResult({ ok: true, text: "Saved." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Your profile could not be saved." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={save}>
      <label className="field">
        <span>Username</span>
        <input
          type="text"
          value={handle}
          maxLength={HANDLE_MAX + 1}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setHandle(e.target.value)}
          required
        />
      </label>
      <p className="field-note">
        How friends find you: @{handle.replace(/^@/, "").toLowerCase() || "yourname"}. Letters, digits and underscores.
      </p>
      <label className="field">
        <span>About You (Optional)</span>
        <textarea rows={2} value={bio} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} />
      </label>
      <label className="field profile-goal-field">
        <span>{`Reading goal for ${goal.year} (Optional)`}</span>
        <input type="number" min={1} max={GOAL_MAX} step={1} value={books} placeholder="Books to finish" onChange={(e) => setBooks(e.target.value)} />
      </label>
      <fieldset className="profile-visibility">
        <legend>Profile Visibility</legend>
        {VISIBILITY.map((v) => (
          <label key={v.id} className="checkline checkline--wrap">
            <input
              type="radio"
              className="square-radio"
              name="profile-visibility"
              checked={visibility === v.id}
              onChange={() => setVisibility(v.id)}
            />
            <span>
              <strong>{v.label}.</strong> {v.text}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="settings-lede">Your notes, words, sources, copies and email are never shown to anyone.</p>
      <div className="settings-row">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? <><Spinner />Saving…</> : "Save"}
        </button>
        <a className="btn" href={`/u/${saved.handle}`}>
          View
        </a>
      </div>
      {result && (
        <p className={result.ok ? "settings-note" : "settings-note settings-note--error"} role="status">
          {result.text}
        </p>
      )}
    </form>
  );
}
