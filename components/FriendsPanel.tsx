"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Someone } from "@/lib/social/friends";
import type { Invite } from "@/lib/social/invites";
import type { Notification } from "@/lib/social/notifications";
import type { Recommendation } from "@/lib/social/recs";
import Avatar from "./Avatar";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";

// The Friends tab: requests to answer, adding someone by handle or with an
// invite link, the friends themselves, requests still waiting, the latest
// news and who's blocked. Every change goes to the API, then the page reloads
// its data (router.refresh).

export interface FriendsData {
  friends: Someone[];
  incoming: Someone[];
  outgoing: Someone[];
  invites: Invite[];
  blocked: { id: string; name: string; handle: string | null }[];
  notifications: Notification[];
  inbox: Recommendation[];
  sent: Recommendation[];
  hasProfile: boolean;
}

const nameOf = (p: { name: string; handle: string | null }) => p.name || (p.handle ? `@${p.handle}` : "A reader");

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

async function call(path: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

function Person({ p, children }: { p: Someone; children?: React.ReactNode }) {
  return (
    <li className="friend">
      <Avatar image={p.image} size={44} />
      <span className="friend-who">
        {p.handle ? (
          <a className="friend-name" href={`/u/${p.handle}`}>
            {nameOf(p)}
          </a>
        ) : (
          <span className="friend-name">{nameOf(p)}</span>
        )}
        {p.handle && p.name && <span className="friend-handle">{`@${p.handle}`}</span>}
      </span>
      <span className="friend-actions">{children}</span>
    </li>
  );
}

const NEWS: Record<Notification["kind"], string> = {
  friend_request: "asked to be your friend",
  friend_accepted: "is now your friend",
  recommendation: "recommended you a book",
};

export default function FriendsPanel({ data, inviteBase }: { data: FriendsData; inviteBase: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // what's being done
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [handle, setHandle] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => Promise<void> } | null>(null);

  const act = async (key: string, path: string, method: string, body?: unknown, done?: (d: Record<string, unknown>) => string) => {
    setBusy(key);
    setMessage(null);
    try {
      const { ok, data: d } = await call(path, method, body);
      if (!ok) throw new Error(typeof d.error === "string" ? d.error : "That didn’t work. Try again.");
      if (done) setMessage({ ok: true, text: done(d) });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "That didn’t work. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = handle.trim().replace(/^@/, "");
    if (!h) return;
    await act("ask", "/api/friends/requests", "POST", { handle: h }, (d) => {
      setHandle("");
      return d.result === "friends"
        ? `@${h} had asked you too: you’re friends now.`
        : d.result === "already"
          ? `You and @${h} are friends already.`
          : `Request sent to @${h}.`;
    });
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch {
      setMessage({ ok: false, text: "Copying didn’t work. Select the link and copy it." });
    }
  };

  const block = (p: Someone) =>
    setConfirm({
      title: `Block ${nameOf(p)}?`,
      message: "You stop being friends, any request between you goes, and neither of you can see or find the other. They aren’t told.",
      label: "Block",
      run: () => act(`block-${p.id}`, `/api/blocks/${p.id}`, "PUT"),
    });

  return (
    <div className="friends">
      {!data.hasProfile && (
        <p className="showcase-note friends-note">
          Your friends can&rsquo;t see your reading until you <a href="/profile">make your profile</a>.
        </p>
      )}

      {message && (
        <p className={message.ok ? "settings-note" : "settings-note settings-note--error"} role="status">
          {message.text}
        </p>
      )}

      {data.incoming.length > 0 && (
        <section className="settings-section">
          <h2 className="form-heading">Asking to be your friend</h2>
          <ul className="friend-list">
            {data.incoming.map((p) => (
              <Person key={p.id} p={p}>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy !== null}
                  onClick={() => act(`yes-${p.id}`, `/api/friends/requests/${p.id}`, "POST", { accept: true }, () => `You and ${nameOf(p)} are friends now.`)}
                >
                  {busy === `yes-${p.id}` ? <><Spinner />Accepting…</> : "Accept"}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => act(`no-${p.id}`, `/api/friends/requests/${p.id}`, "POST", { accept: false })}
                >
                  Decline
                </button>
                <button type="button" className="btn btn--danger" disabled={busy !== null} onClick={() => block(p)}>
                  Block
                </button>
              </Person>
            ))}
          </ul>
        </section>
      )}

      {data.inbox.length > 0 && (
        <section className="settings-section">
          <h2 className="form-heading">Recommended to you</h2>
          <ul className="recs">
            {data.inbox.map((r) => (
              <li key={r.id} className="rec">
                <p className="rec-book">
                  <strong>{r.title}</strong> · {r.author}
                </p>
                <p className="rec-from">
                  From{" "}
                  {r.who.handle ? <a href={`/u/${r.who.handle}`}>{nameOf(r.who)}</a> : nameOf(r.who)}, {dateOf(r.createdAt)}
                </p>
                {r.note && <blockquote className="rec-note">{r.note}</blockquote>}
                <div className="settings-row">
                  {r.inLibrary ? (
                    <>
                      <span className="badge">In your library</span>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy !== null}
                        onClick={() => act(`add-${r.id}`, `/api/recommendations/${r.id}`, "PATCH", { action: "add" })}
                      >
                        Thanks
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={busy !== null}
                      onClick={() =>
                        act(`add-${r.id}`, `/api/recommendations/${r.id}`, "PATCH", { action: "add" }, () => `${r.title} is on your to-read shelf.`)
                      }
                    >
                      {busy === `add-${r.id}` ? <><Spinner />Adding…</> : "Add to my to-read shelf"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn"
                    disabled={busy !== null}
                    onClick={() => act(`dismiss-${r.id}`, `/api/recommendations/${r.id}`, "PATCH", { action: "dismiss" })}
                  >
                    Not for me
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="settings-section">
        <h2 className="form-heading">Add a friend</h2>
        <form className="friends-add" onSubmit={ask}>
          <label className="field">
            <span>Their handle</span>
            <input
              type="text"
              value={handle}
              placeholder="@handle"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setHandle(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy !== null || !handle.trim()}>
            {busy === "ask" ? <><Spinner />Asking…</> : "Ask"}
          </button>
        </form>
        <p className="settings-lede">
          Or send an invite link, by message or email: whoever opens it becomes your friend, signing up first if
          they need to. A link works for a week.
        </p>
        {data.invites.length > 0 && (
          <ul className="friends-invites">
            {data.invites.map((inv) => {
              const url = `${inviteBase}/f/${inv.token}`;
              return (
                <li key={inv.token} className="live-link">
                  <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Invite link" />
                  <button type="button" className="btn btn--primary" onClick={() => copy(url)}>
                    {copied === url ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy !== null}
                    onClick={() => act(`revoke-${inv.token}`, `/api/friends/invites/${inv.token}`, "DELETE")}
                  >
                    Take back
                  </button>
                  <span className="field-note">Works until {dateOf(inv.expiresAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="settings-row">
          <button type="button" className="btn" disabled={busy !== null} onClick={() => act("invite", "/api/friends/invites", "POST")}>
            {busy === "invite" ? <><Spinner />Making…</> : data.invites.length ? "Make another link" : "Make an invite link"}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="form-heading">Your friends</h2>
        {data.friends.length === 0 ? (
          <p className="settings-lede">No friends here yet. Ask someone by their handle, or send them an invite link.</p>
        ) : (
          <ul className="friend-list">
            {data.friends.map((p) => (
              <Person key={p.id} p={p}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() =>
                    setConfirm({
                      title: `Stop being friends with ${nameOf(p)}?`,
                      message: "You stop seeing each other’s reading. They aren’t told.",
                      label: "Unfriend",
                      run: () => act(`unfriend-${p.id}`, `/api/friends/${p.id}`, "DELETE"),
                    })
                  }
                >
                  Unfriend
                </button>
                <button type="button" className="btn btn--danger" disabled={busy !== null} onClick={() => block(p)}>
                  Block
                </button>
              </Person>
            ))}
          </ul>
        )}
      </section>

      {data.outgoing.length > 0 && (
        <section className="settings-section">
          <h2 className="form-heading">Waiting for an answer</h2>
          <ul className="friend-list">
            {data.outgoing.map((p) => (
              <Person key={p.id} p={p}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => act(`withdraw-${p.id}`, `/api/friends/requests/${p.id}`, "DELETE")}
                >
                  Take back
                </button>
              </Person>
            ))}
          </ul>
        </section>
      )}

      {data.sent.length > 0 && (
        <section className="settings-section">
          <h2 className="form-heading">You recommended</h2>
          <ul className="recs">
            {data.sent.map((r) => (
              <li key={r.id} className="rec rec--sent">
                <p className="rec-book">
                  <strong>{r.title}</strong> · {r.author}
                </p>
                <p className="rec-from">
                  To {r.who.handle ? <a href={`/u/${r.who.handle}`}>{nameOf(r.who)}</a> : nameOf(r.who)},{" "}
                  {dateOf(r.createdAt)}
                </p>
                <div className="settings-row">
                  {r.state === "added" ? (
                    <span className="badge badge--read">On their shelf</span>
                  ) : (
                    <>
                      <span className="badge">{r.state === "new" ? "Not seen yet" : "Seen"}</span>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy !== null}
                        onClick={() => act(`unrec-${r.id}`, `/api/recommendations/${r.id}`, "DELETE")}
                      >
                        Take back
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.notifications.length > 0 && (
        <section className="settings-section">
          <h2 className="form-heading">Lately</h2>
          <ul className="friends-news">
            {data.notifications.map((n) => (
              <li key={n.id} className={n.read ? "friends-news-item" : "friends-news-item friends-news-item--new"}>
                <span>
                  <strong>{n.actor ? nameOf(n.actor) : "Someone"}</strong> {NEWS[n.kind]}
                </span>
                <span className="friends-news-date">{dateOf(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.blocked.length > 0 && (
        <section className="settings-section">
          <h2 className="form-heading">Blocked</h2>
          <ul className="friend-list">
            {data.blocked.map((p) => (
              <li key={p.id} className="friend">
                <span className="friend-who">
                  <span className="friend-name">{nameOf(p)}</span>
                </span>
                <span className="friend-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy !== null}
                    onClick={() => act(`unblock-${p.id}`, `/api/blocks/${p.id}`, "DELETE")}
                  >
                    Unblock
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger
          onConfirm={() => {
            const run = confirm.run;
            setConfirm(null);
            void run();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
