import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageAdapter } from "./index";

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

/** Cloudflare R2 (S3-compatible API). The bucket stays private; downloads are proxied after access checks. */
export class R2StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return result.Body ? await result.Body.transformToByteArray() : null;
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
