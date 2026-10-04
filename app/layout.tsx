import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { connection } from "next/server";
import ErrorReporter from "@/components/ErrorReporter";
import SiteBar from "@/components/SiteBar";
import { SiteBarProvider } from "@/components/SiteBarContext";
import { config } from "@/lib/config";
import "./globals.css";

// Archivo Black carries the display type, Archivo everything else; globals.css
// points --font-display / --font-body at them.
const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
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
  // The site bar comes from settings read when the server runs, not when the
  // image was built, so no page may be frozen at build time.
  await connection();
  return (
    <html lang="en" className={`${archivoBlack.variable} ${archivo.variable}`}>
      <body>
        <SiteBar />
        <SiteBarProvider on={Boolean(config.site)}>{children}</SiteBarProvider>
        <ErrorReporter />
      </body>
    </html>
  );
}
