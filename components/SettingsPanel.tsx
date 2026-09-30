"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

interface ImportSummary {
  books: number;
  words: number;
  notes: number;
  images: number;
  skipped: number;
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

export default function SettingsPanel() {
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

  const signOut = async () => {
    await authClient.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="settings">
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

      <section className="settings-section">
        <h2 className="form-heading">Account</h2>
        <button type="button" className="btn" onClick={signOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}
