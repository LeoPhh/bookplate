import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (level?: string) => {
  vi.resetModules();
  if (level === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = level;
  return import("@/lib/log");
};

describe("structured logs", () => {
  afterEach(() => {
    delete process.env.LOG_LEVEL;
    vi.restoreAllMocks();
  });

  it("writes one JSON object per line with time, level, event and version", async () => {
    const { formatLine } = await load();
    const line = JSON.parse(formatLine("warn", "outbound.failed", { service: "itunes", status: 503 }));
    expect(line).toMatchObject({ level: "warn", event: "outbound.failed", service: "itunes", status: 503 });
    expect(new Date(line.t).toString()).not.toBe("Invalid Date");
    expect(line.v).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("turns errors into their name, message and stack", async () => {
    const { formatLine } = await load();
    const err = Object.assign(new Error("boom", { cause: new Error("underneath") }), { code: "ECONNRESET" });
    const { error } = JSON.parse(formatLine("error", "x", { error: err }));
    expect(error).toMatchObject({ name: "Error", message: "boom", code: "ECONNRESET", cause: { message: "underneath" } });
    expect(error.stack).toContain("log.test.ts");
  });

  it("scrubs email addresses, wherever they turn up", async () => {
    const { formatLine } = await load();
    const line = formatLine("error", "email.send_failed", {
      error: new Error("550 mailbox reader@example.com unavailable"),
      note: "for jo.bloggs+books@mail.example.org",
    });
    expect(line).not.toContain("reader@example.com");
    expect(line).not.toContain("jo.bloggs+books@mail.example.org");
    expect(line).toContain("[email]");
  });

  it("names an account by a short, stable hash of its address", async () => {
    const { account } = await load();
    expect(account("Reader@Example.com ")).toBe(account("reader@example.com"));
    expect(account("reader@example.com")).toMatch(/^[0-9a-f]{12}$/);
    expect(account("reader@example.com")).not.toBe(account("other@example.com"));
  });

  it("leaves out lines below LOG_LEVEL", async () => {
    const { log } = await load("warn");
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await log.info("quiet", { req: undefined });
    await log.warn("loud", { req: undefined });
    expect(out.mock.calls.map((c) => JSON.parse(String(c[0])).event)).toEqual(["loud"]);
  });

  it("refuses an unknown LOG_LEVEL", async () => {
    await expect(load("verbose")).rejects.toThrow(/LOG_LEVEL must be/);
  });
});
