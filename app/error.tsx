"use client";

import { useEffect } from "react";
import { reportError } from "@/components/ErrorReporter";

// Shown when a page fails to render. The reference matches the server's log
// line for the same failure, so a bug report can point straight at it.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError("render", error, error.digest), [error]);
  return (
    <main className="page">
      <p className="empty-note" role="alert">
        Something went wrong showing this page.
        {error.digest && <> If it keeps happening, mention reference {error.digest} when you report it.</>}
      </p>
      <button type="button" className="btn btn--primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
