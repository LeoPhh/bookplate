import { redirect } from "next/navigation";
import { connection } from "next/server";
import { countUsers, getSession } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export default async function LoginPage() {
  await connection();
  if ((await countUsers()) === 0) redirect("/setup");
  if (await getSession()) redirect("/");
  return <AuthForm mode="login" />;
}
