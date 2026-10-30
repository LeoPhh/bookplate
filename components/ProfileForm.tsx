"use client";

import { useState } from "react";
import type { Profile, Visibility } from "@/lib/social/profile";
import Spinner from "./Spinner";

// Settings → Profile → Profile page: the username (a handle in the code),
// a line about yourself, who sees the page and what's on it.

const HANDLE_MAX = 24;
const BIO_MAX = 160;

const VISIBILITY: { id: Visibility; label: string; text: string }[] = [
  { id: "private", label: "Only me", text: "Nobody else sees your books or numbers." },
  { id: "friends", label: "Friends", text: "Your friends see them; nobody else does." },
  { id: "public", label: "Everyone", text: "Anyone who opens your profile, signed in or not. Search engines aren’t told about it." },
];

export default function ProfileForm({ initial }: { initial: Profile }) {
  const [saved, setSaved] = useState(initial);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [shareReading, setShareReading] = useState(initial.shareReading);
  const [shareRatings, setShareRatings] = useState(initial.shareRatings);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, bio, visibility, shareReading, shareRatings }),
      });
      const data: { profile?: Profile; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) throw new Error(data.error ?? "Your profile could not be saved.");
      setSaved(data.profile);
      setHandle(data.profile.handle);
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
        <span>About you</span>
        <textarea rows={2} value={bio} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} />
      </label>
      <p className="settings-lede">
        Anyone can open your profile and see your name, photo, username, bio and friends, when you joined and how many
        books you&rsquo;ve read. The rest of your reading — which books, your other numbers and your goal — is up to you.
      </p>
      <fieldset className="profile-visibility">
        <legend>Who sees your reading</legend>
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
      <label className="checkline checkline--wrap switch-line">
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={shareReading}
          onChange={(e) => setShareReading(e.target.checked)}
        />
        <span>
          <strong>What I&rsquo;m reading now.</strong> With how far along you are. Only friends see it.
        </span>
      </label>
      <label className="checkline checkline--wrap switch-line">
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={shareRatings}
          onChange={(e) => setShareRatings(e.target.checked)}
        />
        <span>
          <strong>My ratings.</strong> Stars on your books and your average rating.
        </span>
      </label>
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
