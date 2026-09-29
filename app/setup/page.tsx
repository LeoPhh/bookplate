import { redirect } from "next/navigation";
import { connection } from "next/server";
import { countUsers } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

// First run only: once the owner account exists, this page is gone.
export default async function SetupPage() {
  await connection();
  if ((await countUsers()) > 0) redirect("/login");
  return <AuthForm mode="setup" />;
}
