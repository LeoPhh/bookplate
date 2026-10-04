import { randomUUID } from "crypto";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { describe, expect, it } from "vitest";
import { baseUrl, emailBaseUrl, Visitor } from "./client";
import { waitForMail } from "./mailpit";

// The contact form's back end. The email server has CONTACT_FORM_TO set
// (inbox@test.local); the plain server has no email, so no contact form.

const INBOX = "inbox@test.local";
const someIp = () => `203.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;

// Solves the form's puzzle the way the landing page does.
async function check(v: Visitor): Promise<string> {
  const challenge = await (await v.fetch("/api/contact")).json();
  const solution = await solveChallenge({ challenge, deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

const send = async (v: Visitor, body: Record<string, unknown>) =>
  v.json("/api/contact", "POST", { check: await check(v), ...body });

describe("the contact form", () => {
  it("emails the message to the inbox, with the sender as Reply-To", async () => {
    const v = new Visitor(someIp(), emailBaseUrl());
    const name = `Ada ${randomUUID().slice(0, 8)}`;
    const res = await send(v, {
      name,
      email: "ada@example.com",
      message: "Hello!\n\nDoes it import from <b>StoryGraph</b>?",
    });
    expect(res.status).toBe(200);

    const mail = await waitForMail(INBOX, `Contact form: ${name}`);
    expect(mail.replyTo).toEqual(["ada@example.com"]);
    expect(mail.text).toContain("Does it import from <b>StoryGraph</b>?");
    expect(mail.text).toContain("ada@example.com");
    expect(mail.html).toContain("&lt;b&gt;StoryGraph&lt;/b&gt;"); // shown, never rendered
    expect(mail.text).not.toContain("Just reply to this email"); // a reply goes to the sender
  });

  it("refuses messages without a solved puzzle, and a puzzle twice", async () => {
    const v = new Visitor(someIp(), emailBaseUrl());
    const message = { email: "bot@example.com", message: "Buy now" };
    expect((await v.json("/api/contact", "POST", message)).status).toBe(403);
    expect((await v.json("/api/contact", "POST", { ...message, check: "not-a-puzzle" })).status).toBe(403);
    const solved = await check(v);
    expect((await v.json("/api/contact", "POST", { ...message, check: solved })).status).toBe(200);
    expect((await v.json("/api/contact", "POST", { ...message, check: solved })).status).toBe(403);
  });

  it("needs a reply address and a message", async () => {
    const v = new Visitor(someIp(), emailBaseUrl());
    expect((await send(v, { email: "not-an-address", message: "Hi" })).status).toBe(400);
    expect((await send(v, { email: "a@example.com", message: "   " })).status).toBe(400);
    expect((await send(v, { email: "a@example.com", message: "x".repeat(5_001) })).status).toBe(400);
  });

  it("takes a few messages an hour from one address", async () => {
    const v = new Visitor(someIp(), emailBaseUrl());
    for (let i = 0; i < 5; i++) expect((await send(v, { email: "a@example.com", message: `Hi ${i}` })).status).toBe(200);
    expect((await send(v, { email: "a@example.com", message: "One more" })).status).toBe(429);
  });

  it("doesn't exist on a server without CONTACT_FORM_TO and email", async () => {
    const v = new Visitor(someIp(), baseUrl());
    expect((await v.fetch("/api/contact")).status).toBe(404);
    expect((await v.json("/api/contact", "POST", { email: "a@example.com", message: "Hi" })).status).toBe(404);
  });
});
