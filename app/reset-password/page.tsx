import Link from "next/link";
import { connection } from "next/server";
import AuthShell from "@/components/AuthShell";
import ResetPasswordForm from "@/components/ResetPasswordForm";

// Emailed reset links arrive here as ?token=… (or ?error=INVALID_TOKEN when
// the link has expired or was already used).
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  const { token, error } = await searchParams;
  return (
    <AuthShell title="Choose a new password">
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <p className="auth-lede">This link has expired or was already used. Reset links work once, for an hour.</p>
          <p className="auth-links">
            <Link href="/forgot-password">Send a new link</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
