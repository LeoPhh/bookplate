export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

// Shrinks large images pasted into notes: caps the long edge and re-encodes
// as JPEG so multi-megabyte screenshots don't hit the upload size limit.
// GIFs pass through untouched (re-encoding would drop the animation), as does
// anything already small or that fails to decode.
const NOTES_MAX_EDGE = 1600;
const NOTES_SMALL_ENOUGH = 500 * 1024;

export async function compressForNotes(file: Blob): Promise<Blob> {
  if (file.type === "image/gif" || file.size <= NOTES_SMALL_ENOUGH) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, NOTES_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return jpeg && jpeg.size < file.size ? jpeg : file;
  } catch {
    return file; // undecodable — let the server judge it
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Renders the chosen crop region to a JPEG of the given proportions, capped
// in width so images stay small on disk without visible quality loss at
// display sizes. Defaults suit covers: 2:3, at most 600×900.
export async function cropToJpegBlob(
  src: string,
  area: CropArea,
  { aspect = 2 / 3, maxWidth = 600 }: { aspect?: number; maxWidth?: number } = {}
): Promise<Blob> {
  const img = await loadImage(src);
  const width = Math.max(1, Math.min(maxWidth, Math.round(area.width)));
  const height = Math.round(width / aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", 0.85)
  );
}
