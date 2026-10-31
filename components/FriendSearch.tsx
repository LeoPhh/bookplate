"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Found, Standing } from "@/lib/social/friends";
import Avatar from "./Avatar";
import Spinner from "./Spinner";

// Finding someone to add, on the reader's own friends page: results appear
// under the box while typing (GET /api/friends/search).

const MIN = 2; // SEARCH_MIN in lib/social/friends.ts
const WAIT_MS = 250;

export default function FriendSearch() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  // What came back, and for which term: anything else is still on its way.
  const [found, setFound] = useState<{ term: string; people: Found[]; error: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const term = typed.trim().replace(/^@/, "");
  const searching = term.length >= MIN;
  const current = found?.term === term ? found : null;

  useEffect(() => {
    if (term.length < MIN) return;
    const stop = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(term)}`, { signal: stop.signal });
        const data: { results?: Found[]; error?: string } = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Search failed. Try again.");
        setFound({ term, people: data.results ?? [], error: null });
      } catch (e) {
        if (!stop.signal.aborted) setFound({ term, people: [], error: e instanceof Error ? e.message : "Search failed. Try again." });
      }
    }, WAIT_MS);
    return () => {
      clearTimeout(timer);
      stop.abort();
    };
  }, [term]);

  const act = async (p: Found, path: string, body: unknown, standing: (result: unknown) => Standing) => {
    setBusy(p.id);
    setFailed(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data: { result?: unknown; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t work. Try again.");
      const now = standing(data.result);
      setFound((f) => f && { ...f, people: f.people.map((o) => (o.id === p.id ? { ...o, standing: now } : o)) });
      router.refresh();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "That didn’t work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="friends-find">
      <div className="friends-add">
        <label className="field">
          <span>Name or username</span>
          <input
            type="search"
            value={typed}
            placeholder="Who are you looking for?"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setTyped(e.target.value);
              setFailed(null);
            }}
          />
        </label>
      </div>
      {searching && !current && (
        <p className="search-note" role="status">
          <Spinner />
          Searching…
        </p>
      )}
      {current?.error && <p className="search-note search-note--error">{current.error}</p>}
      {current && !current.error && current.people.length === 0 && <p className="search-note">Nobody by that name or username.</p>}
      {failed && <p className="search-note search-note--error">{failed}</p>}
      {current && current.people.length > 0 && (
        <ul className="search-results">
          {current.people.map((p) => (
            <li key={p.id} className="people-result">
              <Avatar image={p.image} label={p.name || p.handle} color={p.color} size={36} />
              <span className="search-result-text">
                <a className="search-result-title" href={`/u/${p.handle}`}>
                  {p.name || `@${p.handle}`}
                </a>
                {p.name && <span className="search-result-meta">{`@${p.handle}`}</span>}
              </span>
              <span className="people-result-action">
                {p.standing === "none" && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busy !== null}
                    onClick={() => act(p, "/api/friends/requests", { handle: p.handle }, (r) => (r === "sent" ? "sent" : "friends"))}
                  >
                    {busy === p.id ? <><Spinner />Adding…</> : "Add"}
                  </button>
                )}
                {p.standing === "received" && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busy !== null}
                    onClick={() => act(p, `/api/friends/requests/${p.id}`, { accept: true }, () => "friends")}
                  >
                    {busy === p.id ? <><Spinner />Accepting…</> : "Accept"}
                  </button>
                )}
                {p.standing === "sent" && <span className="badge">Request sent</span>}
                {p.standing === "friends" && <span className="badge badge--read">Friends</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
