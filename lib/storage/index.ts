import { config } from "../config";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

// Where uploaded images live: files on disk (LocalStorage) or an
// S3-compatible bucket (S3Storage), chosen by the STORAGE setting. Routes
// only ever talk to this interface. Keys are always namespaced by user: "<userId>/covers/…",
// "<userId>/notes/<bookId>/…".
export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  // Keys directly under a prefix ("<userId>/notes/<bookId>/"), non-recursive.
  list(prefix: string): Promise<string[]>;
  // Removes everything under a prefix.
  deletePrefix(prefix: string): Promise<void>;
  // Throws a readable error if the storage can't be used (checked at startup).
  check?(): Promise<void>;
}

let instance: Storage | null = null;

export function getStorage(): Storage {
  instance ??=
    config.storage === "s3"
      ? new S3Storage({
          endpoint: config.s3.endpoint,
          region: config.s3.region,
          bucket: config.s3.bucket,
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
          forcePathStyle: config.s3.forcePathStyle,
          prefix: config.s3.prefix,
        })
      : new LocalStorage(config.uploadsDir);
  return instance;
}

export { contentTypeOf, detectImageType, EXT_BY_TYPE, isSafeFileName, isSafeId, TYPE_BY_EXT } from "./images";

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
