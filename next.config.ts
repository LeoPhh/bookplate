import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Everything the browser loads comes from Bookplate itself: outside
// services (Open Library, Wiktionary) are always reached through the app's
// own API routes. No `upgrade-insecure-requests`: many self-hosters run on
// plain http inside their network, and it would break every asset there.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js inlines small bootstrap scripts; React needs eval only in dev.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // blob: and data: for the cover cropper and pasted-image previews.
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Never guess a response's type: an uploaded file is only ever an image.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Older browsers' version of frame-ancestors: nobody can embed Bookplate.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // A self-contained server (.next/standalone) for the Docker image.
  output: "standalone",
  // Hide the dev-mode Next.js indicator ("N" bubble in the corner);
  // compile and runtime errors still surface as usual.
  devIndicators: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
