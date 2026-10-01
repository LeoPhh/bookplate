import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { Storage } from ".";
import { contentTypeOf } from "./images";

export interface S3Options {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  prefix: string; // "" or "folder/"
  pageSize?: number; // objects per listing page (S3's maximum is 1000)
}

// Stores each key as an object in an S3-compatible bucket. The bucket stays
// private: images are fetched by the app and passed on to signed-in readers.
export class S3Storage implements Storage {
  private s3: S3Client;
  private bucket: string;
  private prefix: string;
  private pageSize: number;

  constructor(o: S3Options) {
    this.s3 = new S3Client({
      endpoint: o.endpoint,
      region: o.region,
      forcePathStyle: o.forcePathStyle,
      credentials: { accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey },
    });
    this.bucket = o.bucket;
    this.prefix = o.prefix;
    this.pageSize = o.pageSize ?? 1000;
  }

  private object(key: string): string {
    if (key.startsWith("/") || key.split("/").some((part) => part === ".." || part === ".")) {
      throw new Error("Invalid storage key");
    }
    return this.prefix + key;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.object(key), Body: data, ContentType: contentTypeOf(key) })
    );
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.object(key) }));
      return res.Body ? await res.Body.transformToByteArray() : null;
    } catch (e) {
      if (e instanceof S3ServiceException && (e.name === "NoSuchKey" || e.$metadata.httpStatusCode === 404)) return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.object(key) }));
  }

  // Every object key under a prefix, page by page. With `direct`, only the
  // ones right under it (S3 groups deeper ones into "folders" we skip).
  private async *walk(prefix: string, direct: boolean): AsyncGenerator<string> {
    let token: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.object(prefix),
          Delimiter: direct ? "/" : undefined,
          ContinuationToken: token,
          MaxKeys: this.pageSize,
        })
      );
      for (const o of page.Contents ?? []) if (o.Key) yield o.Key;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    for await (const k of this.walk(prefix, true)) keys.push(k.slice(this.prefix.length));
    return keys;
  }

  async deletePrefix(prefix: string): Promise<void> {
    let batch: string[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      const res = await this.s3.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } })
      );
      if (res.Errors?.length) throw new Error(`Could not delete ${res.Errors.length} stored files: ${res.Errors[0].Message}`);
      batch = [];
    };
    for await (const k of this.walk(prefix, false)) {
      batch.push(k);
      if (batch.length === 1000) await flush(); // S3's limit per request
    }
    await flush();
  }

  // Run at startup: fails fast, with a readable reason, if the settings are wrong.
  async check(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (e) {
      const status = e instanceof S3ServiceException ? e.$metadata.httpStatusCode : undefined;
      const why =
        status === 404
          ? `the bucket "${this.bucket}" doesn't exist — create it in your storage provider first`
          : status === 403 || status === 401
            ? "the access key or secret was refused, or the key can't use this bucket"
            : `couldn't reach the storage server (${e instanceof Error ? e.message : String(e)})`;
      throw new Error(`S3 storage isn't working: ${why}. Check the S3_* settings.`);
    }
  }
}
