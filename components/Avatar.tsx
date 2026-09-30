// A profile photo, or — until one is set — the usual head-and-shoulders
// silhouette, in the app's own paper and ink tones.
export default function Avatar({ image, size }: { image?: string | null; size: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" />
      ) : (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" fill="var(--paper-deep)" />
          <circle cx="16" cy="12.5" r="5.5" fill="var(--ink-soft)" />
          <path d="M4.5 32c0-6.6 5.1-11 11.5-11s11.5 4.4 11.5 11z" fill="var(--ink-soft)" />
        </svg>
      )}
    </span>
  );
}
