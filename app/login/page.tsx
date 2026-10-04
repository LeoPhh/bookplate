import { redirect } from "next/navigation";
import { connection } from "next/server";
import { countUsers, getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import AuthForm from "@/components/AuthForm";
import { legalLinks } from "@/lib/legal";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  if ((await countUsers()) === 0) redirect("/setup");
  if (await getSession()) redirect("/");
  // An email-confirmation link that has expired or was already used lands
  // here with ?error=…; signing in sends a fresh one.
  const { error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      signupOpen={config.registration === "open"}
      legal={legalLinks()}
      notice={error ? "That confirmation link has expired or was already used. Sign in to get a new one." : undefined}
    />
  );
}
