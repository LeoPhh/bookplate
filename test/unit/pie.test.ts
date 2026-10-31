import { describe, expect, it } from "vitest";
import { pieSlices, slicePath } from "@/lib/pie";
import { SLICE_COLORS, SLICE_OTHER, SLICE_UNSPECIFIED } from "@/lib/palette";

describe("pieSlices", () => {
  it("shares out the whole, skipping empty rows", () => {
    const s = pieSlices([
      { label: "Fiction", count: 3 },
      { label: "Science", count: 0 },
      { label: "History", count: 1 },
    ]);
    expect(s.map((x) => [x.row.label, x.from, x.to, x.share])).toEqual([
      ["Fiction", 0, 0.75, 75],
      ["History", 0.75, 1, 25],
    ]);
  });

  it("keeps quiet colours for Other and Unspecified, without skipping a colour", () => {
    const s = pieSlices([
      { label: "Fiction", count: 3 },
      { label: "Unspecified", count: 2 },
      { label: "History", count: 2 },
      { label: "Other", count: 1 },
    ]);
    expect(s.map((x) => x.color)).toEqual([SLICE_COLORS[0], SLICE_UNSPECIFIED, SLICE_COLORS[1], SLICE_OTHER]);
  });

  it("has nothing to show for no books", () => {
    expect(pieSlices([{ label: "Fiction", count: 0 }])).toEqual([]);
  });
});

describe("slicePath", () => {
  it("draws a quarter from 12 o'clock to 3 o'clock", () => {
    expect(slicePath(100, 100, 50, 0, 0.25)).toBe("M100 100 L100.000 50.000 A50 50 0 0 1 150.000 100.000 Z");
  });

  it("takes the long way round past half", () => {
    expect(slicePath(100, 100, 50, 0, 0.75)).toContain("A50 50 0 1 1");
  });

  it("draws a whole circle in two arcs, as one arc can't end where it began", () => {
    expect(slicePath(100, 100, 50, 0, 1).match(/A/g)).toHaveLength(2);
  });
});
