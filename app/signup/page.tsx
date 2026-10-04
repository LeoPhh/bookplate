import { redirect } from "next/navigation";
import { connection } from "next/server";
import { countUsers, getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import AuthForm from "@/components/AuthForm";
import { legalLinks } from "@/lib/legal";

// Only on servers with open registration; the very first account always
// comes from /setup.
export default async function SignupPage() {
  await connection();
  if ((await countUsers()) === 0) redirect("/setup");
  if (config.registration !== "open") redirect("/login");
  if (await getSession()) redirect("/");
  return (
    <AuthForm
      mode="signup"
      requireVerification={config.requireEmailVerification}
      botCheck={config.signupBotCheck}
      legal={legalLinks()}
    />
  );
}
