"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProfileIcon from "./ProfileIcon";
import Spinner from "./Spinner";

// The reader's goal for the year on their profile, or for the owner without
// one, an offer to set it. However big the goal, the meter fills the card: a bar
// per book up to 6, squares up to 60, then 100 squares worth 1% each.

const GOAL_MAX = 500;
const ONE_PER_BOOK = 60;

function monthsLeft(today: string): string {
  const n = 12 - Number(today.slice(5, 7));
  return n === 0 ? "this month left" : `${n} ${n === 1 ? "month" : "months"} left`;
}

function Meter({ read, goal }: { read: number; goal: number }) {
  const squares = goal <= ONE_PER_BOOK ? goal : 100;
  const filled = goal <= ONE_PER_BOOK ? Math.min(read, goal) : Math.min(100, Math.floor((read / goal) * 100));
  const columns = goal <= 6 ? goal : goal <= 36 ? 6 : 10;
  const size = goal > 36 ? " profile-meter--small" : "";
  return (
    <div className={`profile-meter${size}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }} aria-hidden="true">
      {Array.from({ length: squares }, (_, i) => (
        <i key={i} className={i < filled ? "on" : undefined} />
      ))}
    </div>
  );
}

export default function GoalCard({
  year,
  read,
  goal,
  owner,
  span,
  today,
}: {
  year: number;
  read: number;
  goal: number | null;
  owner: boolean;
  span: string;
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const send = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goal", init);
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t work. Try again.");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    setDraft(String(goal ?? ""));
    setError(null);
    setEditing(true);
  };

  const dialog = editing && (
    <div className="overlay" onClick={() => setEditing(false)}>
      <form
        className="dialog dialog--confirm"
        role="dialog"
        aria-modal="true"
        aria-label={`Your goal for ${year}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void send({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ books: Number(draft) }) });
        }}
      >
        <h2 className="confirm-title">{`Your goal for ${year}`}</h2>
        <label className="field profile-goal-field">
          <span>Books to finish</span>
          <input type="number" min={1} max={GOAL_MAX} step={1} value={draft} autoFocus required onChange={(e) => setDraft(e.target.value)} />
        </label>
        {error && (
          <p className="settings-note settings-note--error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <><Spinner />Saving…</> : "Save"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </button>
          {goal !== null && (
            <button type="button" className="btn btn--danger" disabled={busy} onClick={() => send({ method: "DELETE" })}>
              Remove goal
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (goal === null) {
    return (
      <section className={`profile-card profile-card--dashed ${span}`}>
        <div className="profile-card-head">
          <ProfileIcon name="target" />
          <h2>{`A goal for ${year}?`}</h2>
        </div>
        <p className="profile-note profile-prompt-text">Only you see this until you set one.</p>
        <button type="button" className="btn profile-prompt-button" onClick={open}>
          Set a goal
        </button>
        {dialog}
      </section>
    );
  }

  const left = goal - read;
  return (
    <section className={`profile-card ${span}`}>
      <div className="profile-card-head">
        <ProfileIcon name="target" />
        <h2>{`${year} goal`}</h2>
        {owner && (
          <button type="button" className="profile-more profile-more--button" onClick={open}>
            Change
          </button>
        )}
      </div>
      <p className="profile-big profile-goal-count">
        {read}
        <small>{` / ${goal}`}</small>
      </p>
      {left <= 0 && <span className="profile-goal-reached">Goal reached</span>}
      <Meter read={read} goal={goal} />
      <p className="profile-note profile-goal-note">
        {left > 0 ? `${left} to go, and ${monthsLeft(today)}.` : left === 0 ? "Goal reached, right on the number." : `Goal reached, with ${-left} extra so far.`}
        {goal > ONE_PER_BOOK ? " Each square is 1% of the goal." : ""}
      </p>
      {dialog}
    </section>
  );
}
