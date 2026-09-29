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
          (s.skipped ? ` ${s.skipped} unreadable records were skipped.` : ""),
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
        <h2 className="form-heading">Account</h2>
        <button type="button" className="btn" onClick={signOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}
