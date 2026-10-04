"use client";

import type { MouseEvent, ReactNode } from "react";

// A link back to wherever the visitor came from — the sign-up page, or another
// site such as the operator's landing page — like the browser's back button.
// Opened directly (new tab, typed address), there's nothing to go back to, so
// it follows href instead.
export default function BackLink({ href, children }: { href: string; children: ReactNode }) {
  function back(e: MouseEvent<HTMLAnchorElement>) {
    if (!document.referrer || window.history.length < 2) return;
    e.preventDefault();
    window.history.back();
  }
  return (
    <a href={href} onClick={back}>
      {children}
    </a>
  );
}
