import { initials } from "@/lib/avatar";
import { paletteFor } from "@/lib/palette";

// A profile photo, or until one is set the reader's initials on their colour
// (lib/avatar.ts). `label` is their name, or their username without one. With
// neither, the usual head-and-shoulders silhouette.
export default function Avatar({
  image,
  label,
  color,
  size,
}: {
  image?: string | null;
  label?: string | null;
  color?: number;
  size: number;
}) {
  const letters = initials(label ?? "");
  const paint = paletteFor(color ?? 3);
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" />
      ) : letters ? (
        <span className="avatar-initials" style={{ background: paint.bg, color: paint.ink, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
          {letters}
        </span>
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
