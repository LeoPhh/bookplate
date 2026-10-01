// Image types and safe names for stored files — shared by the routes and the
// storage drivers.

const SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;
const FILE_RE = /^[a-zA-Z0-9_-]+\.(jpg|png|webp|gif)$/;

export const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Identifies an image by its first bytes rather than trusting the file name
// or the browser's claimed type, so only real images are ever stored.
export function detectImageType(data: Uint8Array): string | null {
  const starts = (...bytes: number[]) => bytes.every((b, i) => data[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif"; // "GIF8"
  // "RIFF" …size… "WEBP"
  if (starts(0x52, 0x49, 0x46, 0x46) && [0x57, 0x45, 0x42, 0x50].every((b, i) => data[8 + i] === b)) {
    return "image/webp";
  }
  return null;
}

export function isSafeId(id: string): boolean {
  return SEGMENT_RE.test(id);
}

export function isSafeFileName(name: string): boolean {
  return FILE_RE.test(name);
}

export function contentTypeOf(name: string): string {
  return TYPE_BY_EXT[name.slice(name.lastIndexOf(".") + 1)] ?? "application/octet-stream";
}
