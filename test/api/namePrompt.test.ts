import { describe, expect, it } from "vitest";
import { reader, type Reader } from "./client";
import { makeProfile, socialReader, uniqueHandle } from "./socialHelpers";

// Readers with no name are asked for one once, and setting one replaces a
// default username (components/NamePrompt.tsx, handleFromNewName).

const PROMPT = "What should we call you?";
const asks = async (r: Reader) => (await (await r.fetch("/")).text()).includes(PROMPT);
const handleOf = async (r: Reader) => (await r.get<{ profile: { handle: string } }>("/api/profile")).profile.handle;
const setName = async (r: Reader, name: string) => expect((await r.json("/api/auth/update-user", "POST", { name })).status).toBe(200);
const unnamed = () => socialReader("");

describe("the name prompt", () => {
  it("asks a reader with no name, until they skip it", async () => {
    const r = await unnamed();
    expect(await asks(r)).toBe(true);
    await r.json("/api/account/hints", "POST", { hint: "name-prompt" });
    expect(await asks(r)).toBe(false);
  });

  it("stops asking once there's a name", async () => {
    const r = await unnamed();
    await setName(r, "Ada Lovelace");
    expect(await asks(r)).toBe(false);
  });

  it("doesn't ask a named reader, or anyone without social features", async () => {
    expect(await asks(await socialReader("Ada Lovelace"))).toBe(false);
    expect(await asks(await reader(""))).toBe(false);
  });
});

describe("setting a name", () => {
  it("replaces a default username, taking the next free one", async () => {
    const [one, two] = [await unnamed(), await unnamed()];
    expect(await handleOf(one)).toMatch(/^reader\d*$/);
    await setName(one, "Grace Hopper");
    await setName(two, "Grace Hopper");
    const [a, b] = [await handleOf(one), await handleOf(two)];
    expect(a).toMatch(/^grace_hopper\d*$/);
    expect(b).toMatch(/^grace_hopper\d*$/);
    expect(a).not.toBe(b);
  });

  it("leaves a username the reader chose", async () => {
    const r = await unnamed();
    const { handle } = await makeProfile(r, { handle: uniqueHandle("mine") });
    await setName(r, "Grace Hopper");
    expect(await handleOf(r)).toBe(handle);
  });

  it("keeps the default when the name has nothing to build one from", async () => {
    const r = await unnamed();
    const handle = await handleOf(r);
    await setName(r, "李");
    expect(await handleOf(r)).toBe(handle);
  });

  it("isn't triggered by clearing a name or other changes", async () => {
    const r = await unnamed();
    const handle = await handleOf(r);
    await setName(r, "");
    expect(await handleOf(r)).toBe(handle);
    expect((await r.json("/api/auth/update-user", "POST", { image: null })).status).toBe(200);
    expect(await handleOf(r)).toBe(handle);
  });
});
