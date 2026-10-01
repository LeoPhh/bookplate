// A flat, hard-edged progress bar in the accent colour.
export default function ProgressBar({ percent, size = "md" }: { percent: number; size?: "sm" | "md" }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <span
      className={`progress-bar progress-bar--${size}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
    >
      <span className="progress-bar-fill" style={{ width: `${p}%` }} />
    </span>
  );
}
