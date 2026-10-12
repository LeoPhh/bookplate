import { describe, expect, it } from "vitest";
import { reader, Visitor } from "./client";

// Info boxes turned off with "Don't show again" (lib/hints.ts).

describe("hints", () => {
  it("stay off once dismissed, for the account", async () => {
    const r = await reader();
    expect(await r.get("/api/account/hints")).toEqual({ dismissed: [] });
    expect(await (await r.json("/api/account/hints", "POST", { hint: "vocabulary" })).json()).toEqual({
      dismissed: ["vocabulary"],
    });
    await r.json("/api/account/hints", "POST", { hint: "vocabulary" }); // again: still once
    expect(await r.get("/api/account/hints")).toEqual({ dismissed: ["vocabulary"] });
    expect(await (await reader()).get("/api/account/hints")).toEqual({ dismissed: [] }); // others unaffected
  });

  it("accept only known hints, from a signed-in reader", async () => {
    const r = await reader();
    expect((await r.json("/api/account/hints", "POST", { hint: "anything" })).status).toBe(400);
    expect((await r.json("/api/account/hints", "POST", {})).status).toBe(400);
    expect((await new Visitor().fetch("/api/account/hints")).status).toBe(401);
    expect((await new Visitor().json("/api/account/hints", "POST", { hint: "vocabulary" })).status).toBe(401);
  });
});
