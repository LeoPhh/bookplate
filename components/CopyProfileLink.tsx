"use client";

import { useEffect, useState } from "react";

// Beside the name on the reader's own profile: copies the page's address, to
// send to anyone. The icon turns to a tick for a moment once it's copied.
export default function CopyProfileLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  const label = copied ? "Copied" : "Copy link to your profile";
  return (
    <>
      <button type="button" className="btn profile-copy" aria-label={label} title={label} onClick={copy}>
        <svg viewBox="0 0 32 32" aria-hidden="true">
          {copied ? (
            <path d="M6 17 L13 24 L26 8" />
          ) : (
            <>
              <path d="M12 12 H28 V28 H12 Z" />
              <path d="M20 12 V4 H4 V20 H12" />
            </>
          )}
        </svg>
      </button>
      {failed && (
        <p className="settings-note settings-note--error" role="alert">
          {`Copying didn’t work. Your link is ${url}`}
        </p>
      )}
    </>
  );
}
