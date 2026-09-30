import { config } from "../config";
import { LocalStorage } from "./local";

// Where uploaded images live. Routes only ever talk to this interface, so a
// second driver (S3 / R2 for a hosted service) can be added without touching
// them. Keys are always namespaced by user: "<userId>/covers/…",
// "<userId>/notes/<bookId>/…".
export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  // Keys directly under a prefix ("<userId>/notes/<bookId>/"), non-recursive.
  list(prefix: string): Promise<string[]>;
  // Removes everything under a prefix.
  deletePrefix(prefix: string): Promise<void>;
}

let instance: Storage | null = null;

export function getStorage(): Storage {
  instance ??= new LocalStorage(config.uploadsDir);
  return instance;
}

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

export const keys = {
  userDir: (userId: string) => `${userId}/`,
  cover: (userId: string, name: string) => `${userId}/covers/${name}`,
  notesDir: (userId: string, bookId: string) => `${userId}/notes/${bookId}/`,
  notesImage: (userId: string, bookId: string, name: string) => `${userId}/notes/${bookId}/${name}`,
  avatarDir: (userId: string) => `${userId}/avatar/`,
  avatar: (userId: string, name: string) => `${userId}/avatar/${name}`,
};

// The URLs the app stores in books and notes. They carry no user id: the
// serving routes resolve the file inside the signed-in user's namespace.
export const urls = {
  cover: (name: string) => `/api/covers/${name}`,
  notesImage: (bookId: string, name: string) => `/api/notes/images/${bookId}/${name}`,
  avatar: (name: string) => `/api/avatar/${name}`,
};
