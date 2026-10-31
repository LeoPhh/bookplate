import { SLICE_COLORS, SLICE_OTHER, SLICE_UNSPECIFIED } from "./palette";

// The shapes and colours of a pie chart. Slices run clockwise from 12 o'clock.

// A slice between two fractions of the way round (0 to 1). A whole circle has
// to be drawn as two arcs: one arc can't end where it began.
export function slicePath(cx: number, cy: number, r: number, from: number, to: number): string {
  const at = (f: number) => {
    const a = 2 * Math.PI * f - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`;
  };
  if (to - from >= 1) return `M${at(0)} A${r} ${r} 0 1 1 ${at(0.5)} A${r} ${r} 0 1 1 ${at(0)} Z`;
  return `M${cx} ${cy} L${at(from)} A${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${at(to)} Z`;
}

export interface Slice<T> {
  row: T;
  from: number;
  to: number;
  share: number; // whole percent
  color: string;
}

// Rows with nothing in them get no slice. "Other" and "Unspecified" have their
// own quiet colours, so the rest keep theirs in order, biggest first.
export function pieSlices<T extends { label: string; count: number }>(rows: T[]): Slice<T>[] {
  const total = rows.reduce((s, r) => s + r.count, 0);
  let done = 0;
  let next = 0;
  return rows
    .filter((r) => r.count > 0)
    .map((row) => {
      const from = done / total;
      done += row.count;
      const color =
        row.label === "Other" ? SLICE_OTHER : row.label === "Unspecified" ? SLICE_UNSPECIFIED : SLICE_COLORS[next++ % SLICE_COLORS.length];
      return { row, from, to: done / total, share: Math.round((row.count / total) * 100), color };
    });
}
