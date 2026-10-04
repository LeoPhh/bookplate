import type { Metadata } from "next";
import { connection } from "next/server";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of use · Bookplate" };

export default async function TermsPage() {
  await connection();
  return <LegalPage name="terms" />;
}
