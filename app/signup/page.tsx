import { redirect } from "next/navigation";
import { connection } from "next/server";
import { countUsers, getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import AuthForm from "@/components/AuthForm";
import { legalLinks } from "@/lib/legal";
import { safeNext } from "@/lib/nextPath";

// Only on servers with open registration; the very first account always
// comes from /setup.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const next = safeNext((await searchParams).next);
  if ((await countUsers()) === 0) redirect("/setup");
  if (config.registration !== "open") redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (await getSession()) redirect(next ?? "/");
  return (
    <AuthForm
      mode="signup"
      requireVerification={config.requireEmailVerification}
      botCheck={config.signupBotCheck}
      legal={legalLinks()}
      newsletter={config.newsletter}
      next={next}
    />
  );
}
