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

export default function SettingsPanel({ user }: { user: ProfileUser }) {
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
      </section>

      <section className="settings-section">
        <h2 className="form-heading">Password</h2>
        <ChangePassword />
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
