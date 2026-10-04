import type { Metadata } from "next";
import { connection } from "next/server";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy · Bookplate" };

export default async function PrivacyPage() {
  await connection();
  return <LegalPage name="privacy" />;
}
