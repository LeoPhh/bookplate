import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import type { Storage } from ".";

// Stores each key as a file under the uploads directory (a Docker volume).
export class LocalStorage implements Storage {
  constructor(private root: string) {}

  private pathFor(key: string): string {
    const full = path.resolve(/* turbopackIgnore: true */ this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const file = this.pathFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    // Temp file + rename, so a crash mid-write never leaves half an image.
    const tmp = `${file}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathFor(key)));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const entries = await readdir(this.pathFor(prefix), { withFileTypes: true });
      return entries.filter((e) => e.isFile() && !e.name.endsWith(".tmp")).map((e) => prefix + e.name);
    } catch {
      return [];
    }
  }

  async usage(prefix: string): Promise<number> {
    let entries;
    try {
      entries = await readdir(this.pathFor(prefix), { recursive: true, withFileTypes: true });
    } catch {
      return 0;
    }
    const sizes = await Promise.all(
      entries.filter((e) => e.isFile()).map((e) => stat(path.join(e.parentPath, e.name)).then((s) => s.size, () => 0))
    );
    return sizes.reduce((a, b) => a + b, 0);
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.pathFor(prefix), { recursive: true, force: true });
  }
}
