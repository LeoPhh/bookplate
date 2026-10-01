import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

// The S3-compatible server the tests use: RustFS from docker-compose.dev.yml
// (a service in CI), or whatever TEST_S3_* points at.

export const S3_TEST = {
  endpoint: process.env.TEST_S3_ENDPOINT ?? "http://localhost:9000",
  region: "us-east-1",
  accessKeyId: process.env.TEST_S3_ACCESS_KEY_ID ?? "bookplate",
  secretAccessKey: process.env.TEST_S3_SECRET_ACCESS_KEY ?? "bookplate-secret",
  forcePathStyle: true,
};

const client = () =>
  new S3Client({
    endpoint: S3_TEST.endpoint,
    region: S3_TEST.region,
    forcePathStyle: true,
    credentials: { accessKeyId: S3_TEST.accessKeyId, secretAccessKey: S3_TEST.secretAccessKey },
  });

export async function createBucket(name: string): Promise<void> {
  try {
    await client().send(new CreateBucketCommand({ Bucket: name }));
  } catch (e) {
    throw new Error(`Couldn't create a test bucket at ${S3_TEST.endpoint} — run \`npm run db:up\` (it starts RustFS). ${e}`);
  }
}

// Empties a bucket and removes it.
export async function removeBucket(name: string): Promise<void> {
  const s3 = client();
  for (;;) {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: name }));
    const objects = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (objects.length === 0) break;
    await s3.send(new DeleteObjectsCommand({ Bucket: name, Delete: { Objects: objects } }));
  }
  await s3.send(new DeleteBucketCommand({ Bucket: name }));
}

// Every object key in a bucket (to check what's actually stored).
export async function objectKeys(name: string): Promise<string[]> {
  const page = await client().send(new ListObjectsV2Command({ Bucket: name }));
  return (page.Contents ?? []).map((o) => o.Key!).sort();
}
