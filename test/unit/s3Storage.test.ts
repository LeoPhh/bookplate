import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { S3Storage } from "@/lib/storage/s3";

// A stand-in bucket that answers every read slowly and counts how many it is
// serving at once.
describe("S3Storage", () => {
  let server: Server;
  let inFlight = 0;
  let peak = 0;
  let storage: S3Storage;

  beforeAll(async () => {
    server = createServer((req, res) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      setTimeout(() => {
        inFlight--;
        res.writeHead(200, { "Content-Type": "image/jpeg" }).end("cover");
      }, 300);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    storage = new S3Storage({
      endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      region: "us-east-1",
      bucket: "test",
      accessKeyId: "test",
      secretAccessKey: "test",
      forcePathStyle: true,
      prefix: "",
    });
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("reads many images at once, beyond the SDK's default of 50", async () => {
    // The SDK sets up its http connection pool on the first request; reads
    // that all start before then would each get their own pool.
    await storage.get("u/covers/first.jpg");
    peak = 0;
    // Above 50, below macOS's queue of 128 pending connections.
    const n = 80;
    const results = await Promise.all(Array.from({ length: n }, (_, i) => storage.get(`u/covers/b${i}.jpg`)));
    expect(results.every((r) => new TextDecoder().decode(r!) === "cover")).toBe(true);
    expect(peak).toBe(n);
  });
});
