"use client";

import { useEffect } from "react";

// Sends uncaught browser errors to the server's log (/api/client-errors):
// at most five different ones per page load, nothing else about the page.
const sent = new Set<string>();

export function reportError(kind: string, error: unknown, digest?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  const key = `${kind}:${e.message}`;
  if (sent.has(key) || sent.size >= 5) return;
  sent.add(key);
  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, message: e.message, stack: e.stack, page: location.pathname, digest }),
    keepalive: true,
  }).catch(() => {});
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportError("error", event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reportError("unhandledrejection", event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
