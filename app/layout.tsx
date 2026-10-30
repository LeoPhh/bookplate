import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { connection } from "next/server";
import ErrorReporter from "@/components/ErrorReporter";
import AppBar from "@/components/AppBar";
import { FeaturesProvider } from "@/components/Features";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { getFeatures } from "@/lib/features";
import { unreadCount } from "@/lib/social/notifications";
import { getProfile } from "@/lib/social/profile";
import { avatarColorIndex } from "@/lib/avatar";
import "./globals.css";

// Fraunces carries the display type, Inter everything else; globals.css
// points --font-display / --font-body at them.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bookplate",
  description: "A personal library of every book read, reading, and awaiting.",
  appleWebApp: {
    title: "Bookplate",
    statusBarStyle: "default",
  },
};

// viewportFit "cover" lets the phone tab bar sit under the home indicator;
// globals.css pads it with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f2ec",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The bar shows the sections only to someone signed in, so every page is
  // rendered per request, never frozen at build time.
  await connection();
  const session = await getSession().catch(() => null);
  // Which optional fields to show, known before anything renders.
  const features = session ? await getFeatures(session.user.id).catch(() => []) : [];
  // With social features, how much is new for the Profile tab's badge.
  const social = config.social ? { unread: session ? await unreadCount(session.user.id).catch(() => 0) : 0 } : null;
  const username = session && config.social ? ((await getProfile(session.user.id).catch(() => null))?.handle ?? null) : null;
  const me = session
    ? {
        image: session.user.image ?? null,
        label: session.user.name || username || session.user.email,
        username,
        color: avatarColorIndex(session.user.id, session.user.avatarColor),
      }
    : null;
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <AppBar signedIn={Boolean(session)} social={social} me={me} />
        <FeaturesProvider initial={features}>{children}</FeaturesProvider>
        <ErrorReporter />
      </body>
    </html>
  );
}
