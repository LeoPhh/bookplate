import { getSession } from "@/lib/auth";
import { recordFailure, throttleWait } from "@/lib/authThrottle";
import { config } from "@/lib/config";
import { DailyLimitError, sendEmail, testEmail } from "@/lib/email";

// POST sends a test email to the signed-in reader, and — unlike the other
// emails — reports exactly what went wrong, so the server's owner can fix
// their SMTP settings.
export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!config.email.enabled) {
    return Response.json({ error: "Email isn’t set up on this server — see SMTP_HOST in the documentation." }, { status: 400 });
  }
  const key = `test-email:${session.user.id}`;
  if ((await throttleWait(key, 5)) > 0) {
    return Response.json({ error: "That’s a lot of test emails — try again in a few minutes." }, { status: 429 });
  }
  await recordFailure(key);
  try {
    await sendEmail(testEmail(session.user.email));
    return Response.json({ ok: true, to: session.user.email });
  } catch (e) {
    if (e instanceof DailyLimitError) return Response.json({ error: e.message }, { status: 429 });
    return Response.json({ error: `The mail server refused: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
