"use client";

import { useState } from "react";
import { pieSlices, slicePath } from "@/lib/pie";

export interface PieRow {
  label: string;
  count: number;
  action?: () => void;
}

const SIZE = 200;
const C = SIZE / 2;
const R = C - 2; // room for the outline

// How a whole divides up: the pie, and its legend with each part's number.
// Parts with an `action` are clickable, in the pie and in the legend.
export default function PieChart({ rows, label, empty }: { rows: PieRow[]; label: string; empty: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const slices = pieSlices(rows);
  if (slices.length === 0) return <p className="empty-note">{empty}</p>;
  const numbers = (s: (typeof slices)[number]) => `${s.row.count} · ${s.share}%`;
  const shown = hover === null ? null : slices[hover];
  const middle = shown ? 2 * Math.PI * ((shown.from + shown.to) / 2) - Math.PI / 2 : 0;

  return (
    <div className="pie">
      <div className="pie-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${label}: ${slices.map((s) => `${s.row.label} ${s.row.count}`).join(", ")}`}>
          {slices.map((s, i) => (
            <path
              key={s.row.label}
              d={slicePath(C, C, R, s.from, s.to)}
              fill={s.color}
              className={hover !== null && hover !== i ? "pie-slice pie-slice--faded" : "pie-slice"}
              style={s.row.action ? { cursor: "pointer" } : undefined}
              onClick={s.row.action}
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {shown && (
          <div
            className="chart-tip"
            style={{ left: `${50 + 30 * Math.cos(middle)}%`, top: `${50 + 30 * Math.sin(middle)}%` }}
          >
            {`${shown.row.label}: ${numbers(shown)}`}
          </div>
        )}
      </div>
      <ul className="pie-legend" onMouseLeave={() => setHover(null)}>
        {slices.map((s, i) => {
          const inner = (
            <>
              <i style={{ background: s.color }} />
              <span className="pie-legend-label">{s.row.label}</span>
              <em>{numbers(s)}</em>
            </>
          );
          return (
            <li key={s.row.label} onMouseEnter={() => setHover(i)}>
              {s.row.action ? (
                <button type="button" className="pie-legend-row" title={s.row.label} onClick={s.row.action}>
                  {inner}
                </button>
              ) : (
                <div className="pie-legend-row" title={s.row.label}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
