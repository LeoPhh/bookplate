import { redirect } from "next/navigation";
import { connection } from "next/server";
import { countUsers, getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import AuthForm from "@/components/AuthForm";
import { legalLinks } from "@/lib/legal";
import { safeNext } from "@/lib/nextPath";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  if ((await countUsers()) === 0) redirect("/setup");
  // ?next= says where to go once signed in (an invite link, say); a
  // confirmation link that signs a new reader in lands here with it too.
  // One that has expired or was already used lands here with ?error=…;
  // signing in sends a fresh one.
  const { error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await getSession()) redirect(next ?? "/");
  return (
    <AuthForm
      mode="login"
      signupOpen={config.registration === "open"}
      next={next}
      legal={legalLinks()}
      notice={error ? "That confirmation link has expired or was already used. Sign in to get a new one." : undefined}
    />
  );
}
