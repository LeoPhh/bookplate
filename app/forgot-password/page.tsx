import Link from "next/link";
import { connection } from "next/server";
import { config } from "@/lib/config";
import AuthShell from "@/components/AuthShell";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  await connection();
  return (
    <AuthShell title="Forgot your password?">
      {config.email.enabled ? (
        <ForgotPasswordForm />
      ) : (
        <>
          <p className="auth-lede">
            This Bookplate can’t send email, so the person who runs it resets passwords on the server, with one command:
          </p>
          <pre className="auth-command">docker compose exec bookplate reset-password you@example.com</pre>
          <p className="auth-lede">
            It asks for a new password and signs out every device. See{" "}
            <a href="https://bookplate.eu/docs#troubleshooting" target="_blank" rel="noopener noreferrer">
              the documentation
            </a>{" "}
            for details, or for setting up email so you can reset it yourself next time.
          </p>
          <p className="auth-links">
            <Link href="/login">Back to sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
