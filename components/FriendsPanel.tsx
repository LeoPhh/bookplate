"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FriendsTab } from "@/lib/friendsTabs";
import type { Someone } from "@/lib/social/friends";
import type { Recommendation } from "@/lib/social/recs";
import Avatar from "./Avatar";
import ConfirmDialog from "./ConfirmDialog";
import FriendSearch from "./FriendSearch";
import MoreMenu from "./MoreMenu";
import SettingsTabs from "./SettingsTabs";
import Spinner from "./Spinner";

// The reader's own friends page (/u/<handle>/friends, from the Friends tile on
// their profile): finding someone to add, then a tab each for their friends,
// requests both ways, and book recommendations both ways. News is in the bell.
// Who's blocked is in Settings. Every change goes to the API, then the page
// reloads its data (router.refresh).

export interface FriendsData {
  friends: Someone[];
  incoming: Someone[];
  outgoing: Someone[];
  inbox: Recommendation[];
  sent: Recommendation[];
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
      <Avatar image={p.image} label={p.name || p.handle} color={p.color} size={44} />
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

export default function FriendsPanel({ data, initialTab = "friends" }: { data: FriendsData; initialTab?: FriendsTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<FriendsTab>(initialTab);
  const [busy, setBusy] = useState<string | null>(null); // what's being done
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
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

  const block = (p: Someone) =>
    setConfirm({
      title: `Block ${nameOf(p)}?`,
      message: "You stop being friends, any request between you goes, and neither of you can see or find the other. They aren’t told.",
      label: "Block",
      run: () => act(`block-${p.id}`, `/api/blocks/${p.id}`, "PUT"),
    });

  const unfriend = (p: Someone) =>
    setConfirm({
      title: `Stop being friends with ${nameOf(p)}?`,
      message: "You stop seeing each other’s reading. They aren’t told.",
      label: "Unfriend",
      run: () => act(`unfriend-${p.id}`, `/api/friends/${p.id}`, "DELETE"),
    });

  const count = (n: number) => <span className="friends-tab-count">{n}</span>;
  const tabs = [
    { id: "friends" as const, label: <>Friends {count(data.friends.length)}</> },
    {
      id: "requests" as const,
      label: (
        <>
          Requests {count(data.incoming.length + data.outgoing.length)}
          {data.incoming.length > 0 && <span className="appbar-badge">{data.incoming.length}</span>}
        </>
      ),
    },
    { id: "recommendations" as const, label: <>Book Recommendations {count(data.inbox.length + data.sent.length)}</> },
  ];
  // Every tab's panel is on the page; only the open one shows.
  const panel = (id: FriendsTab) => ({
    id: `friends-panel-${id}`,
    role: "tabpanel",
    "aria-labelledby": `friends-tab-${id}`,
    hidden: tab !== id,
  });

  return (
    <div className="friends">
      <FriendSearch />
      <SettingsTabs tabs={tabs} active={tab} onChange={setTab} name="Friends" idPrefix="friends" />

      {message && (
        <p className={message.ok ? "settings-note" : "settings-note settings-note--error"} role="status">
          {message.text}
        </p>
      )}

      <section {...panel("friends")}>
        {data.friends.length === 0 ? (
          <p className="settings-lede">No friends here yet. Search for someone above.</p>
        ) : (
          <ul className="friend-list friends-grid">
            {data.friends.map((p) => (
              <Person key={p.id} p={p}>
                <MoreMenu label={`More options for ${nameOf(p)}`} disabled={busy !== null}>
                  {(close) => (
                    <>
                      <button
                        type="button"
                        className="user-menu-item"
                        role="menuitem"
                        onClick={() => {
                          close();
                          unfriend(p);
                        }}
                      >
                        Unfriend
                      </button>
                      <button
                        type="button"
                        className="user-menu-item profile-menu-danger"
                        role="menuitem"
                        onClick={() => {
                          close();
                          block(p);
                        }}
                      >
                        Block
                      </button>
                    </>
                  )}
                </MoreMenu>
              </Person>
            ))}
          </ul>
        )}
      </section>

      <section {...panel("requests")}>
        {data.incoming.length === 0 && data.outgoing.length === 0 && <p className="settings-lede">No requests right now.</p>}
        {data.incoming.length > 0 && (
          <div className="friends-part">
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
                </Person>
              ))}
            </ul>
          </div>
        )}
        {data.outgoing.length > 0 && (
          <div className="friends-part">
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
                    Cancel friend request
                  </button>
                </Person>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section {...panel("recommendations")}>
        {data.inbox.length === 0 && data.sent.length === 0 && (
          <p className="settings-lede">Nothing yet. You can recommend a book from a friend’s profile.</p>
        )}
        {data.inbox.length > 0 && (
          <div className="friends-part">
            <h2 className="form-heading">Recommended to you</h2>
            <ul className="recs">
              {data.inbox.map((r) => (
                <li key={r.id} className="rec">
                  <p className="rec-book">
                    <strong>{r.title}</strong>
                    {r.author && ` · ${r.author}`}
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
          </div>
        )}
        {data.sent.length > 0 && (
          <div className="friends-part">
            <h2 className="form-heading">You recommended</h2>
            <ul className="recs">
              {data.sent.map((r) => (
                <li key={r.id} className="rec rec--sent">
                  <p className="rec-book">
                    <strong>{r.title}</strong>
                    {r.author && ` · ${r.author}`}
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
                          Withdraw Recommendation
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
