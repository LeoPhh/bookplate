export interface SpineColor {
  name: string;
  bg: string; // main cloth/board colour
  deep: string; // darker shade for gradients
  ink: string; // lettering colour
}

// Generated-cover binding colours. A book stores an index into this list, so
// only ever append to it — reordering would recolour existing books.
export const PALETTE: SpineColor[] = [
  { name: "Vermilion", bg: "#ff3b1f", deep: "#e02d13", ink: "#ffffff" },
  { name: "Kelly", bg: "#00994d", deep: "#00713a", ink: "#ffffff" },
  { name: "Klein Blue", bg: "#1a34d6", deep: "#1226a8", ink: "#ffffff" },
  { name: "Signal Yellow", bg: "#ffd400", deep: "#e8bf00", ink: "#111111" },
  { name: "Hot Pink", bg: "#ff5fa2", deep: "#e23d84", ink: "#111111" },
  { name: "Steel", bg: "#5b6670", deep: "#414a52", ink: "#ffffff" },
  { name: "Orange", bg: "#ff8a00", deep: "#d97200", ink: "#111111" },
  { name: "Cyan", bg: "#00b6d8", deep: "#008fab", ink: "#111111" },
  { name: "Purple", bg: "#6a2ecf", deep: "#4d1fa1", ink: "#ffffff" },
  { name: "Grey", bg: "#b8b4aa", deep: "#9a968c", ink: "#111111" },
  { name: "Paper", bg: "#f4f2ec", deep: "#e0dcd2", ink: "#111111" },
  { name: "Ink", bg: "#111111", deep: "#000000", ink: "#ffffff" },
];

export function paletteFor(colorIndex: number): SpineColor {
  const i = ((colorIndex % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i];
}
