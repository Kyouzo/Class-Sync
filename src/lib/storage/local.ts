import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter } from "./index";

/** Stores files on the local filesystem. Intended for development; Vercel's filesystem is ephemeral. */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    // Keys are generated server-side, but guard against path traversal regardless.
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key.");
    return full;
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
