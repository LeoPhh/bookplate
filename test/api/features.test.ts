import { describe, expect, it } from "vitest";
import { reader, Visitor } from "./client";

// Optional features (Settings → Optional features, lib/featureList.ts).

describe("optional features", () => {
  it("start off, and switch on and off", async () => {
    const r = await reader();
    expect(await r.get("/api/account/features")).toEqual({ features: [] });
    expect(await (await r.json("/api/account/features", "PATCH", { feature: "source", on: true })).json()).toEqual({
      features: ["source"],
    });
    await r.json("/api/account/features", "PATCH", { feature: "source", on: true }); // still once
    await r.json("/api/account/features", "PATCH", { feature: "copy", on: true });
    expect(await r.get("/api/account/features")).toEqual({ features: ["source", "copy"] });
    await r.json("/api/account/features", "PATCH", { feature: "source", on: false });
    expect(await r.get("/api/account/features")).toEqual({ features: ["copy"] });
  });

  it("are offered in Settings", async () => {
    const html = await (await (await reader()).fetch("/settings")).text();
    expect(html).toContain("Optional features");
    expect(html).toContain("Whether you own a physical copy");
  });

  it("accept only known features and true or false, from a signed-in reader", async () => {
    const r = await reader();
    expect((await r.json("/api/account/features", "PATCH", { feature: "nope", on: true })).status).toBe(400);
    expect((await r.json("/api/account/features", "PATCH", { feature: "copy", on: "yes" })).status).toBe(400);
    expect((await new Visitor().fetch("/api/account/features")).status).toBe(401);
  });
});
