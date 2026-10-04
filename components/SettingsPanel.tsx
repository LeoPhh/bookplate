"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { fileToDataUrl } from "@/lib/image";
import Avatar from "./Avatar";
import ImageCropper from "./ImageCropper";

interface ImportSummary {
  books: number;
  words: number;
  notes: number;
  images: number;
  skipped: number;
}

interface ProfileUser {
  name: string;
  email: string;
  image: string | null;
}

// Tells every useSession() on the page (the avatar in the masthead) to
// fetch the account again after the photo changes.
function refreshSession() {
  authClient.$store.notify("$sessionSignal");
}

function Profile({ user }: { user: ProfileUser }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(user.image);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setError(null);
    try {
      setRawImage(await fileToDataUrl(file));
    } catch {
      setError("That image could not be opened.");
    }
  };

  const upload = async (blob: Blob) => {
    setRawImage(null);
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      const data: { image?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.image) throw new Error(data.error ?? "The photo could not be saved.");
      setImage(data.image);
      refreshSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photo could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setImage(null);
      refreshSession();
    } catch {
      setError("The photo could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile">
      <Avatar image={image} size={112} />
      <div className="profile-body">
        <p className="profile-name">{user.name}</p>
        <p className="profile-email">{user.email}</p>
        <div className="settings-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pick(file);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Saving…" : image ? "Change photo…" : "Add a photo…"}
          </button>
          {image && (
            <button type="button" className="btn" disabled={busy} onClick={remove}>
              Remove photo
            </button>
          )}
        </div>
        {error && (
          <p className="settings-note settings-note--error" role="alert">
            {error}
          </p>
        )}
      </div>
      {rawImage && (
        <ImageCropper
          imageSrc={rawImage}
          aspect={1}
          round
          maxWidth={256}
          title="Crop your photo"
          hint="Drag to position the photo and zoom to fit; the circle is what shows."
          confirmLabel="Use this photo"
          onConfirm={upload}
          onCancel={() => setRawImage(null)}
        />
      )}
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setResult({ ok: false, text: "The new passwords don't match." });
      return;
    }
    setBusy(true);
    setResult(null);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      // Anyone signed in elsewhere (another browser, a lost phone) is signed out.
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) {
      setResult({ ok: false, text: error.message ?? "The password could not be changed." });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setResult({ ok: true, text: "Password changed. Other devices have been signed out." });
  };

  return (
    <form className="book-form settings-password" onSubmit={submit}>
      <label className="field field--wide">
        <span>Current password</span>
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        <span>New password</span>
        <input
          type="password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label className="field">
        <span>Repeat new password</span>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {result && (
        <p className={result.ok ? "settings-note field--wide" : "settings-note settings-note--error field--wide"} role="status">
          {result.text}
        </p>
      )}
      <div className="field--wide">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Changing…" : "Change password"}
        </button>
      </div>
    </form>
  );
}

// Permanently deletes the account and its whole library, after the password.
function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "The account could not be deleted.");
      }
      window.location.href = "/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "The account could not be deleted.");
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn--danger" onClick={() => setOpen(true)}>
        Delete account
      </button>
    );
  }

  return (
    <form className="book-form settings-password" onSubmit={submit}>
      <label className="field field--wide">
        <span>Your password, to confirm</span>
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <p className="settings-note settings-note--error field--wide" role="alert">
          {error}
        </p>
      )}
      <div className="field--wide settings-row">
        <button type="submit" className="btn btn--danger-solid" disabled={busy || !password}>
          {busy ? "Deleting…" : "Delete my account and library"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setPassword("");
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface CsvSummary {
  source: "goodreads" | "storygraph";
  total: number;
  added: number;
  updated: number;
  read: number;
  reading: number;
  toRead: number;
  dnf: number;
  withIsbn: number;
  notes: number;
  skipped: number;
}

const SOURCE_NAMES = { goodreads: "Goodreads", storygraph: "StoryGraph" } as const;

// Open Library allows ~100 ISBN cover lookups per 5 minutes from one address.
const COVER_PACE_MS = 3000;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// Goodreads / StoryGraph CSV import: preview, import, then optionally find
// covers for the imported books one at a time.
function CsvImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ summary: CsvSummary; coverIds: string[] } | null>(null);
  const [covers, setCovers] = useState<{ done: number; found: number; total: number; running: boolean } | null>(null);

  const send = async (f: File, mode: "preview" | "apply") => {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("mode", mode);
    const res = await fetch("/api/import/csv", { method: "POST", body: fd });
    const data: { summary?: CsvSummary; coverIds?: string[]; error?: string } = await res.json().catch(() => ({}));
    if (!res.ok || !data.summary) throw new Error(data.error ?? "The import failed.");
    return data as { summary: CsvSummary; coverIds?: string[] };
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const choose = async (f: File) => {
    reset();
    setImported(null);
    setCovers(null);
    setBusy(true);
    try {
      const { summary } = await send(f, "preview");
      setFile(f);
      setPreview(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { summary, coverIds } = await send(file, "apply");
      setImported({ summary, coverIds: coverIds ?? [] });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setBusy(false);
    }
  };

  const findCovers = async () => {
    if (!imported) return;
    const ids = imported.coverIds;
    stopRef.current = false;
    let found = 0;
    let done = 0;
    setCovers({ done: 0, found: 0, total: ids.length, running: true });
    for (let i = 0; i < ids.length && !stopRef.current; i++) {
      try {
        const res = await fetch("/api/covers/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId: ids[i] }),
        });
        const data: { found?: boolean; error?: string; busy?: boolean; retryAfterMs?: number } = await res
          .json()
          .catch(() => ({}));
        if (data.busy) {
          // The server is pacing lookups for everyone: wait, then try this book again.
          await new Promise((r) => setTimeout(r, Math.min(data.retryAfterMs ?? 10_000, 30_000)));
          i--;
          continue;
        }
        if (res.status === 403) {
          // Out of image space: stop, and say so.
          setError(data.error ?? "No room for more covers.");
          break;
        }
        if (data.found) found++;
      } catch {
        // skip this one
      }
      done = i + 1;
      setCovers({ done, found, total: ids.length, running: true });
      if (i < ids.length - 1) await new Promise((r) => setTimeout(r, COVER_PACE_MS));
    }
    // After a Stop, the rest can be looked up later with the same button.
    setImported((prev) => (prev ? { ...prev, coverIds: ids.slice(done) } : prev));
    setCovers((c) => (c ? { ...c, running: false } : c));
  };

  const s = preview;
  const minutes = imported ? Math.max(1, Math.round((imported.coverIds.length * COVER_PACE_MS) / 60000)) : 0;

  return (
    <div className="csv-import">
      <h3 className="settings-subheading">From Goodreads or StoryGraph</h3>
      <p className="settings-lede">
        In Goodreads, use <strong>My Books → Import and export → Export Library</strong>; in StoryGraph,{" "}
        <strong>Manage Account → Export StoryGraph Library</strong>. Then choose the CSV file here — you&rsquo;ll see what
        will be imported before anything is saved. Importing again later updates the same books instead of duplicating
        them.
      </p>
      <div className="settings-row">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void choose(f);
          }}
        />
        <button type="button" className="btn" disabled={busy || covers?.running} onClick={() => fileRef.current?.click()}>
          {busy && !preview ? "Reading…" : "Choose a CSV…"}
        </button>
      </div>

      {s && (
        <div className="csv-preview" role="status">
          <p className="csv-preview-title">
            {SOURCE_NAMES[s.source]} export · {plural(s.total, "book")}
          </p>
          <ul>
            <li>
              {s.read.toLocaleString()} read · {s.reading.toLocaleString()} reading · {s.toRead.toLocaleString()} to read
            </li>
            <li>
              {plural(s.added, "new book")}
              {s.updated ? `, and ${plural(s.updated, "book")} already in your library will be updated` : ""}
            </li>
            {s.notes > 0 && <li>{plural(s.notes, "review")} will become notes pages</li>}
            {s.dnf > 0 && <li>{plural(s.dnf, "did-not-finish book")} will be imported as TBR</li>}
            {s.skipped > 0 && <li>{plural(s.skipped, "row")} without a title or author will be skipped</li>}
          </ul>
          <div className="settings-row">
            <button type="button" className="btn btn--primary" disabled={busy || s.total === 0} onClick={apply}>
              {busy ? "Importing…" : `Import ${plural(s.total, "book")}`}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {imported && (
        <div className="csv-preview" role="status">
          <p className="csv-preview-title">
            Imported {plural(imported.summary.total, "book")} from {SOURCE_NAMES[imported.summary.source]}
          </p>
          <p className="settings-note">
            {plural(imported.summary.added, "new book")}, {imported.summary.updated.toLocaleString()} updated.
          </p>
          {covers && (
            <p className="settings-note">
              {covers.running
                ? `Finding covers… ${covers.done} of ${covers.total} (${covers.found} found)`
                : `Found ${plural(covers.found, "cover")} for ${plural(covers.done, "book")}.`}
            </p>
          )}
          {covers?.running ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              Stop
            </button>
          ) : (
            imported.coverIds.length > 0 && (
              <>
                <p className="settings-lede">
                  Exports don&rsquo;t include covers. Bookplate can look them up on Open Library — one book every few
                  seconds to stay within its limits, so about {plural(minutes, "minute")} for{" "}
                  {plural(imported.coverIds.length, "book")}. Keep this page open; books without a cover found keep their
                  cloth one.
                </p>
                <button type="button" className="btn btn--primary" onClick={findCovers}>
                  Find covers for {plural(imported.coverIds.length, "book")}
                </button>
              </>
            )
          )}
        </div>
      )}

      {error && (
        <p className="settings-note settings-note--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Whether this server can send email, and a way to check that it works.
function EmailStatus({ email, to }: { email: { from: string } | null; to: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!email) {
    return (
      <p className="settings-lede">
        Email isn’t set up, so forgotten passwords are reset by whoever runs the server, with{" "}
        <code>reset-password</code>. Add <code>SMTP_HOST</code> and the other email settings to let people reset their
        own — see{" "}
        <a href="https://bookplate.eu/docs#configuration" target="_blank" rel="noopener noreferrer">
          the documentation
        </a>
        .
      </p>
    );
  }

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/email/test", { method: "POST" });
      const data: { to?: string; error?: string } = await res.json().catch(() => ({}));
      setResult(res.ok ? { ok: true, text: `Sent to ${data.to}. Check your inbox.` } : { ok: false, text: data.error ?? "It didn’t send." });
    } catch {
      setResult({ ok: false, text: "It didn’t send — is the server still running?" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="settings-lede">
        Email is set up, sending as <strong>{email.from}</strong>. Password-reset links go out by email.
      </p>
      <button type="button" className="btn" disabled={busy} onClick={send}>
        {busy ? "Sending…" : `Send a test email to ${to}`}
      </button>
      {result && (
        <p className={result.ok ? "settings-note" : "settings-note settings-note--error"} role="status">
          {result.text}
        </p>
      )}
    </>
  );
}

export default function SettingsPanel({ user, email }: { user: ProfileUser; email: { from: string } | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const runImport = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data: { summary?: ImportSummary; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.summary) {
        setResult({ ok: false, text: data.error ?? "The import failed." });
        return;
      }
      const s = data.summary;
      setResult({
        ok: true,
        text:
          `Imported ${s.books} ${s.books === 1 ? "book" : "books"}, ${s.words} ${s.words === 1 ? "word" : "words"}, ` +
          `${s.notes} notes and ${s.images} images.` +
          (s.skipped ? ` ${s.skipped} unreadable items were skipped.` : ""),
      });
    } catch {
      setResult({ ok: false, text: "The import failed — is the server still running?" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="settings">
      <section className="settings-section">
        <h2 className="form-heading">Profile</h2>
        <Profile user={user} />
      </section>

      <section className="settings-section">
        <h2 className="form-heading">Export</h2>
        <p className="settings-lede">
          Download everything — books, notes, pasted images, covers and vocabulary — as a zip of plain JSON, markdown
          and image files. It&rsquo;s your backup, and it imports into any Bookplate.
        </p>
        <a className="btn btn--primary" href="/api/export" download>
          Export library
        </a>
      </section>

      <section className="settings-section">
        <h2 className="form-heading">Import</h2>
        <p className="settings-lede">
          Bring in a Bookplate export, or a zip of the <code>data</code> folder from the original self-run app. Books
          and words with matching ids are updated; nothing already here is removed.
        </p>
        <div className="settings-row">
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void runImport(file);
            }}
          />
          <button type="button" className="btn" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? "Importing…" : "Choose a zip…"}
          </button>
        </div>
        {result && (
          <p className={result.ok ? "settings-note" : "settings-note settings-note--error"} role="status">
            {result.text}
          </p>
        )}
        <CsvImport />
      </section>

      <section className="settings-section">
        <h2 className="form-heading">Password</h2>
        <ChangePassword />
      </section>

      <section className="settings-section">
        <h2 className="form-heading">Email</h2>
        <EmailStatus email={email} to={user.email} />
      </section>

      <section className="settings-section settings-section--danger">
        <h2 className="form-heading">Danger zone</h2>
        <p className="settings-lede">
          Deleting your account permanently removes it along with every book, note, pasted image, cover and word in
          it. This can&rsquo;t be undone — export your library first if you might want it back.
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}
