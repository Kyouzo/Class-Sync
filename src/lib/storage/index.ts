import "server-only";
import { LocalStorageAdapter } from "./local";
import { R2StorageAdapter } from "./r2";

/** Minimal blob storage contract used for lesson attachments. */
export interface StorageAdapter {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

let adapter: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (adapter) return adapter;
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "r2") {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
      throw new Error("STORAGE_DRIVER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.");
    }
    adapter = new R2StorageAdapter({
      accountId: R2_ACCOUNT_ID,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      bucket: R2_BUCKET,
    });
  } else if (driver === "local") {
    adapter = new LocalStorageAdapter(process.env.LOCAL_STORAGE_DIR ?? "./storage");
  } else {
    throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use "local" or "r2".`);
  }
  return adapter;
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? 4);
  return Math.max(1, Math.min(Number.isFinite(mb) ? mb : 4, 4.4)) * 1024 * 1024;
}

/** Allow-list of attachment types (extension -> MIME type). */
export const ALLOWED_ATTACHMENTS: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
