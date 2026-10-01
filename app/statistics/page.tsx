"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Book, ProgressEntry } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import StatsView from "@/components/StatsView";
import SiteNav from "@/components/SiteNav";

export default function StatisticsPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, progressRes] = await Promise.all([apiFetch("/api/books"), apiFetch("/api/progress")]);
        if (!res.ok) throw new Error();
        const data: { books: Book[] } = await res.json();
        const progressData: { progress: ProgressEntry[] } = progressRes.ok ? await progressRes.json() : { progress: [] };
        if (cancelled) return;
        setProgress(progressData.progress);
        const loaded = data.books;
        setBooks(loaded.map((b) => (b.status ? b : { ...b, status: "to-read" })));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Drilling into a book leaves the stats page and opens the book's detail
  // on the library, where editing and notes live.
  const openBook = (id: string) => router.push(`/?book=${encodeURIComponent(id)}`);

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Statistics</h1>
        <p className="masthead-stats">The shelf, counted and charted.</p>
        <SiteNav active="statistics" />
      </header>

      {books === null ? (
        <p className="empty-note">
          {loadError ? "The library could not be opened — is the server still running?" : "Opening the ledger…"}
        </p>
      ) : books.length === 0 ? (
        <p className="empty-note">No books yet — add one from the library to see it counted here.</p>
      ) : (
        <StatsView books={books} progress={progress} onSelect={openBook} />
      )}

      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
